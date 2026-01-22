import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { readdirSync, existsSync } from "fs";
import { isAuthenticated } from "@/lib/auth";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, BUNDLES_DIR } from "@/lib/data-paths";
import {
  type NormalizedCompany,
  type NormalizedPerson,
} from "@/lib/normalize";
import { readDateData } from "@/lib/data-reader";

type SearchCompany = NormalizedCompany & {
  sourceDate: string;
  hasMail: boolean;
  hasAudit: boolean;
  hasPreview: boolean;
  worthySite: boolean;
  hasEmail: boolean;
  hasDomain: boolean;
};

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
    const hasMail = parseBooleanParam(searchParams.get("hasMail"));
    const hasAudit = parseBooleanParam(searchParams.get("hasAudit"));
    const hasPreview = parseBooleanParam(searchParams.get("hasPreview"));
    const worthySite = parseBooleanParam(searchParams.get("worthy"));
    const hasEmail = parseBooleanParam(searchParams.get("hasEmail"));
    const hasDomain = parseBooleanParam(searchParams.get("hasDomain"));
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

    const allCompanies: SearchCompany[] = [];
    const allPeople: (NormalizedPerson & { sourceDate: string })[] = [];
    const seenCompanies = new Set<string>();
    const seenPeople = new Set<string>();

    for (const { path: dateDir, date } of dateDirs) {
      try {
        const { data } = await readDateData(dateDir);

        const mailCompanies = new Set(data.mails.map((m) => m.mapp).filter(Boolean));
        const auditCompanies = new Set(data.audits.map((a) => a.mapp).filter(Boolean));
        const previewCompanies = new Set<string>();
        const worthyCompanies = new Set<string>();
        const emailCompanies = new Set<string>();
        const domainCompanies = new Set<string>();

        data.companies.forEach((c) => {
          if (c.preview_url && c.mapp) previewCompanies.add(c.mapp);
          if (c.ska_fa_sajt?.toLowerCase() === "ja" && c.mapp) worthyCompanies.add(c.mapp);
          if ((c.epost || c.emails_found) && c.mapp) emailCompanies.add(c.mapp);
          if ((c.domain_verified || c.domain_guess) && c.mapp) domainCompanies.add(c.mapp);
        });

        data.mails.forEach((m) => {
          if (m.mapp) {
            if (m.site_preview_url) previewCompanies.add(m.mapp);
            if (m.email) emailCompanies.add(m.mapp);
          }
        });

        data.evaluations.forEach((e) => {
          if (e.mapp) {
            if (e.preview_url) previewCompanies.add(e.mapp);
            if (e.ska_fa_sajt?.toLowerCase() === "ja") worthyCompanies.add(e.mapp);
          }
        });

        for (const company of data.companies) {
          const key = company.mapp || company.orgnr;
          if (!key || seenCompanies.has(key)) continue;

          const flags = {
            hasMail: mailCompanies.has(company.mapp),
            hasAudit: auditCompanies.has(company.mapp),
            hasPreview: previewCompanies.has(company.mapp) || !!company.preview_url,
            worthySite: worthyCompanies.has(company.mapp) || company.ska_fa_sajt?.toLowerCase() === "ja",
            hasEmail: emailCompanies.has(company.mapp) || !!company.epost || !!company.emails_found,
            hasDomain: domainCompanies.has(company.mapp) || !!company.domain_verified || !!company.domain_guess,
          };

          if (
            matchesCompanyFilters(
              company,
              flags,
              query,
              segment,
              lan,
              hasMail,
              hasAudit,
              hasPreview,
              worthySite,
              hasEmail,
              hasDomain
            )
          ) {
            seenCompanies.add(key);
            allCompanies.push({ ...company, sourceDate: date, ...flags });
          }
        }

        for (const person of data.people) {
          const key = `${person.personnummer}-${person.kungorelse_id}`;
          if (seenPeople.has(key)) continue;

          if (matchesPersonFilters(person, query)) {
            seenPeople.add(key);
            allPeople.push({ ...person, sourceDate: date });
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
      hasMail,
      hasAudit,
      hasPreview,
      worthySite,
      hasEmail,
      hasDomain,
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

function matchesCompanyFilters(
  company: NormalizedCompany,
  flags: {
    hasMail: boolean;
    hasAudit: boolean;
    hasPreview: boolean;
    worthySite: boolean;
    hasEmail: boolean;
    hasDomain: boolean;
  },
  query: string,
  segment: string,
  lan: string,
  hasMail: boolean,
  hasAudit: boolean,
  hasPreview: boolean,
  worthySite: boolean,
  hasEmail: boolean,
  hasDomain: boolean
): boolean {
  // Segment filter
  if (segment && company.segment !== segment) {
    return false;
  }

  // Län filter
  if (lan && company.lan !== lan) {
    return false;
  }

  if (hasMail && !flags.hasMail) return false;
  if (hasAudit && !flags.hasAudit) return false;
  if (hasPreview && !flags.hasPreview) return false;
  if (worthySite && !flags.worthySite) return false;
  if (hasEmail && !flags.hasEmail) return false;
  if (hasDomain && !flags.hasDomain) return false;

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
    person.mapp,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  
  return searchText.includes(query);
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
