import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { readdirSync, existsSync } from "fs";
import { isAuthenticated } from "@/lib/auth";
import Database from "better-sqlite3";
import { parseExcelFile } from "@/lib/excel";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, BUNDLES_DIR } from "@/lib/data-paths";
import {
  normalizeCompany,
  normalizePerson,
  type NormalizedCompany,
  type NormalizedPerson,
} from "@/lib/normalize";

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.toLowerCase() || "";
    const segment = searchParams.get("segment") || "";
    const lan = searchParams.get("lan") || "";
    const limit = parseInt(searchParams.get("limit") || "200");

    // Find all date directories
    const dateDirs: { path: string; date: string }[] = [];
    
    for (const baseDir of [PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, BUNDLES_DIR]) {
      if (existsSync(baseDir)) {
        try {
          const entries = readdirSync(baseDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && /^\d{8}$/.test(entry.name)) {
              dateDirs.push({ path: join(baseDir, entry.name), date: entry.name });
            }
          }
        } catch {
          // Skip
        }
      }
    }

    // Sort by date descending
    dateDirs.sort((a, b) => b.date.localeCompare(a.date));

    const allCompanies: (NormalizedCompany & { sourceDate: string })[] = [];
    const allPeople: (NormalizedPerson & { sourceDate: string })[] = [];
    const seenCompanies = new Set<string>();
    const seenPeople = new Set<string>();

    for (const { path: dateDir, date } of dateDirs) {
      try {
        const files = readdirSync(dateDir);

        // Process SQLite
        for (const file of files) {
          if (file.endsWith(".db")) {
            const dbPath = join(dateDir, file);
            try {
              const db = new Database(dbPath, { readonly: true });
              const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table'")
                .all() as { name: string }[];

              if (tables.some((t) => t.name === "companies")) {
                const rows = db.prepare("SELECT * FROM companies").all() as Record<string, unknown>[];
                for (const row of rows) {
                  const company = normalizeCompany(row);
                  const key = company.mapp || company.orgnr;
                  if (!key || seenCompanies.has(key)) continue;
                  
                  if (matchesFilters(company, query, segment, lan)) {
                    seenCompanies.add(key);
                    allCompanies.push({ ...company, sourceDate: date });
                  }
                }
              }

              if (tables.some((t) => t.name === "people" || t.name === "personer")) {
                const tableName = tables.find((t) => t.name === "people" || t.name === "personer")?.name;
                if (tableName) {
                  const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];
                  for (const row of rows) {
                    const person = normalizePerson(row);
                    const key = `${person.personnummer}-${person.kungorelse_id}`;
                    if (seenPeople.has(key)) continue;
                    
                    if (matchesPersonFilters(person, query)) {
                      seenPeople.add(key);
                      allPeople.push({ ...person, sourceDate: date });
                    }
                  }
                }
              }

              db.close();
            } catch (e) {
              console.error(`Error reading ${dbPath}:`, e);
            }
          }
        }

        // Process Excel
        for (const file of files) {
          if (file.endsWith(".xlsx")) {
            const xlsxPath = join(dateDir, file);
            try {
              const { sheets } = await parseExcelFile(xlsxPath);

              const companySheet = sheets["Huvuddata"] || sheets["Data"] || [];
              for (const row of companySheet as Record<string, unknown>[]) {
                const company = normalizeCompany(row);
                const key = company.mapp || company.orgnr;
                if (!key || seenCompanies.has(key)) continue;
                
                if (matchesFilters(company, query, segment, lan)) {
                  seenCompanies.add(key);
                  allCompanies.push({ ...company, sourceDate: date });
                }
              }

              const peopleSheet = sheets["Personer"] || [];
              for (const row of peopleSheet as Record<string, unknown>[]) {
                const person = normalizePerson(row);
                const key = `${person.personnummer}-${person.kungorelse_id}`;
                if (seenPeople.has(key)) continue;
                
                if (matchesPersonFilters(person, query)) {
                  seenPeople.add(key);
                  allPeople.push({ ...person, sourceDate: date });
                }
              }
            } catch (e) {
              console.error(`Error reading ${xlsxPath}:`, e);
            }
          }
        }

        // Stop early if we have enough results
        if (allCompanies.length >= limit && allPeople.length >= limit) {
          break;
        }
      } catch (e) {
        console.error(`Error processing ${dateDir}:`, e);
      }
    }

    return NextResponse.json({
      query,
      segment,
      lan,
      companies: allCompanies.slice(0, limit),
      people: allPeople.slice(0, limit),
      totalCompanies: allCompanies.length,
      totalPeople: allPeople.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

function matchesFilters(
  company: NormalizedCompany,
  query: string,
  segment: string,
  lan: string
): boolean {
  // Segment filter
  if (segment && company.segment !== segment) {
    return false;
  }

  // Län filter
  if (lan && company.lan !== lan) {
    return false;
  }

  // Text search
  if (query) {
    const searchText = [
      company.foretagsnamn,
      company.orgnr,
      company.mapp,
      company.sate,
      company.epost,
      company.verksamhet,
      company.segment,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    
    if (!searchText.includes(query)) {
      return false;
    }
  }

  return true;
}

function matchesPersonFilters(person: NormalizedPerson, query: string): boolean {
  if (!query) return false; // Only return people if there's a search query
  
  const searchText = [
    person.fornamn,
    person.efternamn,
    person.foretagsnamn,
    person.orgnr,
    person.ort,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  
  return searchText.includes(query);
}
