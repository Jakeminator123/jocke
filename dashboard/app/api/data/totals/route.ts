import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getAllDateDirPaths } from "@/lib/data-paths";
import { readDateData } from "@/lib/data-reader";
import { ensureIndexDb, getIndexedDates, indexDateData } from "@/lib/index-db";

interface TotalStats {
  totalCompanies: number;
  totalPeople: number;
  totalMails: number;
  totalAudits: number;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  companiesWithMail: number;
  companiesWithAudit: number;
  companiesWithPreview: number;
  companiesWorthySite: number;
  segments: Record<string, number>;
  lans: Record<string, number>;
  domainStatuses: Record<string, number>;
}

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dateDirs = await getAllDateDirPaths();

    if (dateDirs.length > 0) {
      await ensureIndexForDates(dateDirs);
      return NextResponse.json(queryTotalsFromIndex(dateDirs.length));
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
      companiesWithMail: 0,
      companiesWithAudit: 0,
      companiesWithPreview: 0,
      companiesWorthySite: 0,
      segments: {},
      lans: {},
      domainStatuses: {},
    };

    const seenCompanies = new Set<string>();
    const seenPeople = new Set<string>();
    const mailCompanies = new Set<string>();
    const auditCompanies = new Set<string>();
    const previewCompanies = new Set<string>();
    const worthyCompanies = new Set<string>();
    const emailCompanies = new Set<string>();
    const domainCompanies = new Set<string>();

    for (const dateDir of dateDirs) {
      try {
        const { data } = await readDateData(dateDir);

        totals.totalMails += data.mails.length;
        totals.totalAudits += data.audits.length;

        data.companies.forEach((c) => {
          const key = c.mapp || c.orgnr;
          if (!key || seenCompanies.has(key)) return;
          seenCompanies.add(key);
          totals.totalCompanies++;

          if (c.domain_verified || c.domain_guess) domainCompanies.add(key);
          if (c.epost || c.emails_found) emailCompanies.add(key);
          if (c.phones_found) totals.companiesWithPhone++;

          if (c.preview_url) previewCompanies.add(key);
          if (c.ska_fa_sajt?.toLowerCase() === "ja") worthyCompanies.add(key);

          const status = c.domain_status || "unknown";
          totals.domainStatuses[status] = (totals.domainStatuses[status] || 0) + 1;

          const segment = c.segment || "Okänt";
          totals.segments[segment] = (totals.segments[segment] || 0) + 1;

          const lan = c.lan || "Okänt";
          totals.lans[lan] = (totals.lans[lan] || 0) + 1;
        });

        data.people.forEach((p) => {
          const key = `${p.personnummer || ""}-${p.kungorelse_id || ""}`;
          if (seenPeople.has(key)) return;
          seenPeople.add(key);
          totals.totalPeople++;
        });

        data.mails.forEach((m) => {
          if (m.mapp) {
            mailCompanies.add(m.mapp);
            if (m.site_preview_url) previewCompanies.add(m.mapp);
            if (m.email) emailCompanies.add(m.mapp);
          }
        });

        data.audits.forEach((a) => {
          if (a.mapp) auditCompanies.add(a.mapp);
        });

        data.evaluations.forEach((e) => {
          if (e.mapp) {
            if (e.preview_url) previewCompanies.add(e.mapp);
            if (e.ska_fa_sajt?.toLowerCase() === "ja") worthyCompanies.add(e.mapp);
          }
        });
      } catch (e) {
        console.error(`Error processing ${dateDir}:`, e);
      }
    }

    totals.companiesWithDomain = domainCompanies.size;
    totals.companiesWithEmail = emailCompanies.size;
    totals.companiesWithMail = mailCompanies.size;
    totals.companiesWithAudit = auditCompanies.size;
    totals.companiesWithPreview = previewCompanies.size;
    totals.companiesWorthySite = worthyCompanies.size;

    return NextResponse.json({
      totalCompanies: totals.totalCompanies,
      totalPeople: totals.totalPeople,
      totalMails: totals.totalMails,
      totalAudits: totals.totalAudits,
      companiesWithDomain: totals.companiesWithDomain,
      companiesWithEmail: totals.companiesWithEmail,
      companiesWithPhone: totals.companiesWithPhone,
      companiesWithMail: totals.companiesWithMail,
      companiesWithAudit: totals.companiesWithAudit,
      companiesWithPreview: totals.companiesWithPreview,
      companiesWorthySite: totals.companiesWorthySite,
      totalDates: dateDirs.length,
      segments: totals.segments,
      lans: totals.lans,
      domainStatuses: totals.domainStatuses,
    });
  } catch (error) {
    console.error("Error calculating totals:", error);
    return NextResponse.json({ error: "Failed to calculate totals" }, { status: 500 });
  }
}

function queryTotalsFromIndex(totalDates: number) {
  const db = ensureIndexDb();

  const companyKey = "COALESCE(NULLIF(mapp,''), NULLIF(orgnr,''))";

  const totalCompanies = db.prepare(`SELECT COUNT(DISTINCT ${companyKey}) as count FROM companies`).get() as { count: number };
  const totalPeople = db.prepare("SELECT COUNT(DISTINCT personnummer || '-' || kungorelse_id) as count FROM people").get() as { count: number };
  const totalMails = db.prepare("SELECT COUNT(*) as count FROM mails").get() as { count: number };
  const totalAudits = db.prepare("SELECT COUNT(*) as count FROM audits").get() as { count: number };

  const companiesWithDomain = db.prepare(
    `SELECT COUNT(DISTINCT ${companyKey}) as count FROM companies WHERE domain_verified <> '' OR domain_guess <> ''`
  ).get() as { count: number };

  const companiesWithEmail = db.prepare(
    `SELECT COUNT(DISTINCT ${companyKey}) as count FROM companies WHERE epost <> '' OR emails_found <> ''`
  ).get() as { count: number };

  const companiesWithPhone = db.prepare(
    `SELECT COUNT(DISTINCT ${companyKey}) as count FROM companies WHERE phones_found <> ''`
  ).get() as { count: number };

  const companiesWithMail = db.prepare(
    `SELECT COUNT(DISTINCT mapp) as count FROM mails WHERE mapp <> ''`
  ).get() as { count: number };

  const companiesWithAudit = db.prepare(
    `SELECT COUNT(DISTINCT mapp) as count FROM audits WHERE mapp <> ''`
  ).get() as { count: number };

  const companiesWithPreview = db.prepare(`
    SELECT COUNT(DISTINCT key) as count FROM (
      SELECT ${companyKey} as key FROM companies WHERE preview_url <> ''
      UNION
      SELECT mapp as key FROM mails WHERE site_preview_url <> ''
      UNION
      SELECT mapp as key FROM evaluations WHERE preview_url <> ''
    ) WHERE key IS NOT NULL AND key <> ''
  `).get() as { count: number };

  const companiesWorthySite = db.prepare(
    `SELECT COUNT(DISTINCT ${companyKey}) as count FROM companies WHERE lower(ska_fa_sajt) = 'ja'`
  ).get() as { count: number };

  const segmentsRows = db.prepare(
    `SELECT segment as key, COUNT(DISTINCT ${companyKey}) as count FROM companies GROUP BY segment`
  ).all() as { key: string | null; count: number }[];

  const lansRows = db.prepare(
    `SELECT lan as key, COUNT(DISTINCT ${companyKey}) as count FROM companies GROUP BY lan`
  ).all() as { key: string | null; count: number }[];

  const statusRows = db.prepare(
    `SELECT COALESCE(domain_status,'unknown') as key, COUNT(DISTINCT ${companyKey}) as count FROM companies GROUP BY domain_status`
  ).all() as { key: string; count: number }[];

  db.close();

  const segments: Record<string, number> = {};
  segmentsRows.forEach((row) => {
    const key = row.key || "Okänt";
    segments[key] = row.count;
  });

  const lans: Record<string, number> = {};
  lansRows.forEach((row) => {
    const key = row.key || "Okänt";
    lans[key] = row.count;
  });

  const domainStatuses: Record<string, number> = {};
  statusRows.forEach((row) => {
    const key = row.key || "unknown";
    domainStatuses[key] = row.count;
  });

  return {
    totalCompanies: totalCompanies.count || 0,
    totalPeople: totalPeople.count || 0,
    totalMails: totalMails.count || 0,
    totalAudits: totalAudits.count || 0,
    companiesWithDomain: companiesWithDomain.count || 0,
    companiesWithEmail: companiesWithEmail.count || 0,
    companiesWithPhone: companiesWithPhone.count || 0,
    companiesWithMail: companiesWithMail.count || 0,
    companiesWithAudit: companiesWithAudit.count || 0,
    companiesWithPreview: companiesWithPreview.count || 0,
    companiesWorthySite: companiesWorthySite.count || 0,
    totalDates,
    segments,
    lans,
    domainStatuses,
  };
}

async function ensureIndexForDates(dateDirs: string[]) {
  const indexed = getIndexedDates();
  for (const dateDir of dateDirs) {
    const date = dateDir.split(/[\\/]/).pop() || "";
    if (!indexed.has(date)) {
      const { data } = await readDateData(dateDir);
      indexDateData(date, data);
    }
  }
}
