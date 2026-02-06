import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAllDateDirPaths } from "@/lib/data-paths";
import { type NormalizedCompany, type NormalizedPerson } from "@/lib/normalize";
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

    if (dateDirs.length === 0) {
      return NextResponse.json({
        query, segment, lan, hasMail, hasAudit, hasPreview,
        worthySite, hasEmail, hasDomain,
        companies: [], people: [], totalCompanies: 0, totalPeople: 0,
      });
    }

    // Ensure all dates are indexed, then query from SQLite index
    await ensureIndexForDates(datePairs);
    return NextResponse.json(querySearchFromIndex({
      query, segment, lan,
      hasMail, hasAudit, hasPreview,
      worthySite, hasEmail, hasDomain,
      limit,
    }));
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
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
