import { NextResponse } from "next/server";
import { join } from "path";
import { readdirSync } from "fs";
import { isAuthenticated } from "@/lib/auth";
import Database from "better-sqlite3";
import { parseExcelFile } from "@/lib/excel";
import { getExistingDateDir, PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, BUNDLES_DIR } from "@/lib/data-paths";
import { existsSync } from "fs";

interface TotalStats {
  totalCompanies: number;
  totalPeople: number;
  totalMails: number;
  totalAudits: number;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  uniqueSegments: Set<string>;
  uniqueLans: Set<string>;
  segments: Record<string, number>;
  lans: Record<string, number>;
}

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find all date directories
    const dateDirs: string[] = [];
    
    for (const baseDir of [PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, BUNDLES_DIR]) {
      if (existsSync(baseDir)) {
        try {
          const entries = readdirSync(baseDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && /^\d{8}$/.test(entry.name)) {
              dateDirs.push(join(baseDir, entry.name));
            }
          }
        } catch {
          // Skip if can't read
        }
      }
    }

    // Aggregate stats
    const totals: TotalStats = {
      totalCompanies: 0,
      totalPeople: 0,
      totalMails: 0,
      totalAudits: 0,
      companiesWithDomain: 0,
      companiesWithEmail: 0,
      companiesWithPhone: 0,
      uniqueSegments: new Set(),
      uniqueLans: new Set(),
      segments: {},
      lans: {},
    };

    const seenCompanies = new Set<string>();
    const seenPeople = new Set<string>();

    for (const dateDir of dateDirs) {
      try {
        const files = readdirSync(dateDir);
        
        // Process SQLite databases
        for (const file of files) {
          if (file.endsWith(".db")) {
            const dbPath = join(dateDir, file);
            try {
              const db = new Database(dbPath, { readonly: true });
              const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type='table'")
                .all() as { name: string }[];
              
              if (tables.some(t => t.name === "companies")) {
                const companies = db.prepare("SELECT * FROM companies").all() as Record<string, unknown>[];
                for (const c of companies) {
                  const key = String(c.mapp || c.orgnr || "");
                  if (key && !seenCompanies.has(key)) {
                    seenCompanies.add(key);
                    totals.totalCompanies++;
                    
                    if (c.domain_verified || c.domain_guess) totals.companiesWithDomain++;
                    if (c.epost || c.emails_found) totals.companiesWithEmail++;
                    if (c.phones_found) totals.companiesWithPhone++;
                    
                    const segment = String(c.segment || "Okänt");
                    totals.segments[segment] = (totals.segments[segment] || 0) + 1;
                    totals.uniqueSegments.add(segment);
                    
                    const lan = String(c.lan || "Okänt");
                    totals.lans[lan] = (totals.lans[lan] || 0) + 1;
                    totals.uniqueLans.add(lan);
                  }
                }
              }
              
              if (tables.some(t => t.name === "people" || t.name === "personer")) {
                const tableName = tables.find(t => t.name === "people" || t.name === "personer")?.name;
                if (tableName) {
                  const people = db.prepare(`SELECT * FROM ${tableName}`).all() as Record<string, unknown>[];
                  for (const p of people) {
                    const key = `${p.personnummer || ""}-${p.kungorelse_id || ""}`;
                    if (!seenPeople.has(key)) {
                      seenPeople.add(key);
                      totals.totalPeople++;
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

        // Process Excel files
        for (const file of files) {
          if (file.endsWith(".xlsx")) {
            const xlsxPath = join(dateDir, file);
            try {
              const { sheets } = await parseExcelFile(xlsxPath);
              
              // Companies from Huvuddata or Data
              const companySheet = sheets["Huvuddata"] || sheets["Data"] || [];
              for (const c of companySheet as Record<string, unknown>[]) {
                const key = String(c["Mapp"] || c["Org.nr"] || "");
                if (key && !seenCompanies.has(key)) {
                  seenCompanies.add(key);
                  totals.totalCompanies++;
                  
                  if (c["domain_verified"] || c["domain_guess"]) totals.companiesWithDomain++;
                  if (c["E-post"] || c["emails_found"]) totals.companiesWithEmail++;
                  if (c["phones_found"]) totals.companiesWithPhone++;
                  
                  const segment = String(c["Segment"] || "Okänt");
                  totals.segments[segment] = (totals.segments[segment] || 0) + 1;
                  totals.uniqueSegments.add(segment);
                  
                  const lan = String(c["Län"] || "Okänt");
                  totals.lans[lan] = (totals.lans[lan] || 0) + 1;
                  totals.uniqueLans.add(lan);
                }
              }
              
              // People from Personer
              const peopleSheet = sheets["Personer"] || [];
              for (const p of peopleSheet as Record<string, unknown>[]) {
                const key = `${p["Personnummer"] || ""}-${p["Kungörelse-id"] || ""}`;
                if (!seenPeople.has(key)) {
                  seenPeople.add(key);
                  totals.totalPeople++;
                }
              }
              
              // Mails
              const mailSheet = sheets["Mails"] || sheets["Mail"] || [];
              totals.totalMails += (mailSheet as unknown[]).length;
              
              // Audits
              const auditSheet = sheets["Audits"] || [];
              totals.totalAudits += (auditSheet as unknown[]).length;
              
            } catch (e) {
              console.error(`Error reading ${xlsxPath}:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`Error processing ${dateDir}:`, e);
      }
    }

    return NextResponse.json({
      totalCompanies: totals.totalCompanies,
      totalPeople: totals.totalPeople,
      totalMails: totals.totalMails,
      totalAudits: totals.totalAudits,
      companiesWithDomain: totals.companiesWithDomain,
      companiesWithEmail: totals.companiesWithEmail,
      companiesWithPhone: totals.companiesWithPhone,
      totalDates: dateDirs.length,
      segments: totals.segments,
      lans: totals.lans,
    });
  } catch (error) {
    console.error("Error calculating totals:", error);
    return NextResponse.json({ error: "Failed to calculate totals" }, { status: 500 });
  }
}
