import { NextResponse } from "next/server";
import { join } from "path";
import { readdirSync } from "fs";
import { isAuthenticated } from "@/lib/auth";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR, BUNDLES_DIR } from "@/lib/data-paths";
import { existsSync } from "fs";
import { readDateData } from "@/lib/data-reader";

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
