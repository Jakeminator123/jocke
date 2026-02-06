import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAllDateDirPaths } from "@/lib/data-paths";
import {
  type NormalizedCompany,
  type NormalizedPerson,
} from "@/lib/normalize";
import { readDateData } from "@/lib/data-reader";
import { ensureIndexDb, getIndexedDates, indexDateData } from "@/lib/index-db";

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

    const dateDirs = await getAllDateDirPaths();
    const datePairs = dateDirs.map((path) => ({
      path,
      date: path.split(/[\\/]/).pop() || "",
    }));

    if (dateDirs.length > 0) {
      await ensureIndexForDates(datePairs);
      return NextResponse.json(querySearchFromIndex({
        query,
        segment,
        lan,
        hasMail,
        hasAudit,
        hasPreview,
        worthySite,
        hasEmail,
        hasDomain,
        limit,
      }));
    }

    const allCompanies: SearchCompany[] = [];
    const allPeople: (NormalizedPerson & { sourceDate: string })[] = [];
    const seenCompanies = new Set<string>();
    const seenPeople = new Set<string>();

    for (const { path: dateDir, date } of datePairs) {
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

async function ensureIndexForDates(datePairs: Array<{ path: string; date: string }>) {
  const indexed = getIndexedDates();
  for (const { path, date } of datePairs) {
    if (!indexed.has(date)) {
      const { data } = await readDateData(path);
      indexDateData(date, data);
    }
  }
}

function querySearchFromIndex(options: {
  query: string;
  segment: string;
  lan: string;
  hasMail: boolean;
  hasAudit: boolean;
  hasPreview: boolean;
  worthySite: boolean;
  hasEmail: boolean;
  hasDomain: boolean;
  limit: number;
}) {
  const db = ensureIndexDb();
  const {
    query,
    segment,
    lan,
    hasMail,
    hasAudit,
    hasPreview,
    worthySite,
    hasEmail,
    hasDomain,
    limit,
  } = options;

  const filters: string[] = [];
  const params: Array<string | number> = [];

  if (segment) {
    filters.push("segment = ?");
    params.push(segment);
  }
  if (lan) {
    filters.push("lan = ?");
    params.push(lan);
  }
  if (query) {
    filters.push("search_text LIKE ?");
    params.push(`%${query.toLowerCase()}%`);
  }

  if (hasMail) {
    filters.push("mapp IN (SELECT DISTINCT mapp FROM mails WHERE mapp <> '')");
  }
  if (hasAudit) {
    filters.push("mapp IN (SELECT DISTINCT mapp FROM audits WHERE mapp <> '')");
  }
  if (hasPreview) {
    filters.push(
      "(preview_url <> '' OR mapp IN (SELECT DISTINCT mapp FROM mails WHERE site_preview_url <> '') OR mapp IN (SELECT DISTINCT mapp FROM evaluations WHERE preview_url <> ''))"
    );
  }
  if (worthySite) {
    filters.push(
      "(lower(ska_fa_sajt) = 'ja' OR mapp IN (SELECT DISTINCT mapp FROM evaluations WHERE lower(ska_fa_sajt) = 'ja'))"
    );
  }
  if (hasEmail) {
    filters.push(
      "(epost <> '' OR emails_found <> '' OR mapp IN (SELECT DISTINCT mapp FROM mails WHERE email <> ''))"
    );
  }
  if (hasDomain) {
    filters.push("(domain_verified <> '' OR domain_guess <> '')");
  }

  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const countSql = `SELECT COUNT(*) as count FROM companies ${where}`;
  const listSql = `SELECT * FROM companies ${where} ORDER BY date DESC LIMIT ?`;

  const totalCompanies = db.prepare(countSql).get(...params) as { count: number };
  const companies = db.prepare(listSql).all(...params, limit) as SearchCompany[];

  const people: (NormalizedPerson & { sourceDate: string })[] = [];
  let totalPeople = 0;
  if (query) {
    const peopleCountSql = "SELECT COUNT(*) as count FROM people WHERE search_text LIKE ?";
    const peopleListSql = "SELECT * FROM people WHERE search_text LIKE ? LIMIT ?";
    totalPeople = (db.prepare(peopleCountSql).get(`%${query.toLowerCase()}%`) as { count: number }).count || 0;
    const rows = db.prepare(peopleListSql).all(`%${query.toLowerCase()}%`, limit) as Array<NormalizedPerson & { date: string }>;
    rows.forEach((row) => {
      people.push({ ...row, sourceDate: row.date });
    });
  }

  const mailCompanies = new Set(
    db.prepare("SELECT DISTINCT mapp FROM mails WHERE mapp <> ''").all().map((row: { mapp: string }) => row.mapp)
  );
  const auditCompanies = new Set(
    db.prepare("SELECT DISTINCT mapp FROM audits WHERE mapp <> ''").all().map((row: { mapp: string }) => row.mapp)
  );
  const previewCompanies = new Set(
    db.prepare("SELECT DISTINCT mapp FROM mails WHERE site_preview_url <> ''").all().map((row: { mapp: string }) => row.mapp)
  );
  db.prepare("SELECT DISTINCT mapp FROM evaluations WHERE preview_url <> ''").all().forEach((row: { mapp: string }) => previewCompanies.add(row.mapp));

  const worthyCompanies = new Set(
    db.prepare("SELECT DISTINCT mapp FROM evaluations WHERE lower(ska_fa_sajt) = 'ja'").all().map((row: { mapp: string }) => row.mapp)
  );

  const emailCompanies = new Set(
    db.prepare("SELECT DISTINCT mapp FROM mails WHERE email <> ''").all().map((row: { mapp: string }) => row.mapp)
  );

  const domainCompanies = new Set(
    db.prepare("SELECT DISTINCT mapp FROM companies WHERE domain_verified <> '' OR domain_guess <> ''").all().map((row: { mapp: string }) => row.mapp)
  );

  const enrichedCompanies = companies.map((company) => ({
    ...company,
    sourceDate: (company as unknown as { date: string }).date,
    hasMail: mailCompanies.has(company.mapp),
    hasAudit: auditCompanies.has(company.mapp),
    hasPreview: previewCompanies.has(company.mapp) || !!company.preview_url,
    worthySite: worthyCompanies.has(company.mapp) || company.ska_fa_sajt?.toLowerCase() === "ja",
    hasEmail: emailCompanies.has(company.mapp) || !!company.epost || !!company.emails_found,
    hasDomain: domainCompanies.has(company.mapp) || !!company.domain_verified || !!company.domain_guess,
  })) as SearchCompany[];

  db.close();

  return {
    query,
    segment,
    lan,
    hasMail,
    hasAudit,
    hasPreview,
    worthySite,
    hasEmail,
    hasDomain,
    companies: enrichedCompanies,
    people,
    totalCompanies: totalCompanies.count || 0,
    totalPeople,
  };
}
