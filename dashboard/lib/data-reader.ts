import { readdirSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";
import { parseExcelFile } from "@/lib/excel";
import {
  normalizeCompanies,
  normalizePeople,
  normalizeMails,
  normalizeAudits,
  normalizeEvaluations,
  normalizeSummary,
  mergeLinkedData,
  findSheetByNames,
  COMPANY_SHEET_NAMES,
  PEOPLE_SHEET_NAMES,
  MAIL_SHEET_NAMES,
  AUDIT_SHEET_NAMES,
  EVALUATION_SHEET_NAMES,
  SUMMARY_SHEET_NAMES,
  type NormalizedCompany,
  type NormalizedPerson,
  type NormalizedMail,
  type NormalizedAudit,
  type NormalizedEvaluation,
  type NormalizedSummary,
  type NormalizedData,
} from "@/lib/normalize";

export interface ReadDateDataResult {
  data: NormalizedData;
  source: string;
}

export async function readDateData(dateDir: string): Promise<ReadDateDataResult> {
  const data: NormalizedData = {
    companies: [],
    people: [],
    mails: [],
    audits: [],
    evaluations: [],
    summary: null,
  };

  let source = "unknown";
  let preferCompanySource = false;
  let preferPeopleSource = false;
  const files = readdirSync(dateDir);

  // Process SQLite databases
  for (const file of files) {
    if (file.endsWith(".db")) {
      const dbPath = join(dateDir, file);
      const dbData = getDataFromSQLite(dbPath);
      data.companies.push(...dbData.companies);
      data.people.push(...dbData.people);
      source = "sqlite";
    }
  }

  // Process Excel files
  for (const file of files) {
    if (file.endsWith(".xlsx")) {
      const xlsxPath = join(dateDir, file);
      const xlsxData = await getDataFromExcel(xlsxPath, file);

      if (xlsxData.companies.length > 0) {
        if (file.includes("final") || file.includes("kungorelser")) {
          data.companies = xlsxData.companies;
          preferCompanySource = true;
        } else if (!preferCompanySource && data.companies.length === 0) {
          data.companies = xlsxData.companies;
        }
      }

      if (xlsxData.people.length > 0) {
        if (file.includes("final")) {
          data.people = xlsxData.people;
          preferPeopleSource = true;
        } else if (!preferPeopleSource && data.people.length === 0) {
          data.people = xlsxData.people;
        }
      }

      data.mails.push(...xlsxData.mails);
      data.audits.push(...xlsxData.audits);

      if (xlsxData.evaluations.length > 0 && data.evaluations.length === 0) {
        data.evaluations = xlsxData.evaluations;
      }

      if (xlsxData.summary && !data.summary) {
        data.summary = xlsxData.summary;
      }

      if (file.includes("final")) {
        source = "excel-final";
      } else if (file.includes("mail_ready") && source === "unknown") {
        source = "excel-mail";
      } else if (source === "unknown") {
        source = "excel";
      }
    }
  }

  data.mails = deduplicateByCompositeKey(data.mails, (m) => `${m.mapp}|${m.email}|${m.subject}`);
  data.audits = deduplicateByCompositeKey(data.audits, (a) => `${a.mapp}|${a.hemsida}|${a.audit_datum}`);

  const merged = mergeLinkedData(data);

  return { data: merged, source };
}

function deduplicateByCompositeKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = keyFn(item);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function getDataFromSQLite(dbPath: string): {
  companies: NormalizedCompany[];
  people: NormalizedPerson[];
} {
  const db = new Database(dbPath, { readonly: true });

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  const tableNames = tables.map((t) => t.name);

  let rawCompanies: Record<string, unknown>[] = [];
  let rawPeople: Record<string, unknown>[] = [];

  if (tableNames.includes("companies")) {
    rawCompanies = db.prepare("SELECT * FROM companies").all() as Record<string, unknown>[];
  }

  if (tableNames.includes("people")) {
    rawPeople = db.prepare("SELECT * FROM people").all() as Record<string, unknown>[];
  } else if (tableNames.includes("personer")) {
    rawPeople = db.prepare("SELECT * FROM personer").all() as Record<string, unknown>[];
  }

  db.close();

  return {
    companies: normalizeCompanies(rawCompanies),
    people: normalizePeople(rawPeople),
  };
}

async function getDataFromExcel(filePath: string, fileName: string): Promise<{
  companies: NormalizedCompany[];
  people: NormalizedPerson[];
  mails: NormalizedMail[];
  audits: NormalizedAudit[];
  evaluations: NormalizedEvaluation[];
  summary: NormalizedSummary | null;
}> {
  const { sheets, sheetNames } = await parseExcelFile(filePath);

  let rawCompanies = findSheetByNames(sheets, COMPANY_SHEET_NAMES);
  if (rawCompanies.length === 0 && sheetNames.length > 0) {
    if (fileName.includes("kungorelser")) {
      rawCompanies = sheets[sheetNames[0]] || [];
    }
  }

  const rawPeople = findSheetByNames(sheets, PEOPLE_SHEET_NAMES);
  const rawMails = findSheetByNames(sheets, MAIL_SHEET_NAMES);
  const rawAudits = findSheetByNames(sheets, AUDIT_SHEET_NAMES);
  const rawEvaluations = findSheetByNames(sheets, EVALUATION_SHEET_NAMES);
  const rawSummary = findSheetByNames(sheets, SUMMARY_SHEET_NAMES);

  return {
    companies: normalizeCompanies(rawCompanies as Record<string, unknown>[]),
    people: normalizePeople(rawPeople as Record<string, unknown>[]),
    mails: normalizeMails(rawMails as Record<string, unknown>[]),
    audits: normalizeAudits(rawAudits as Record<string, unknown>[]),
    evaluations: normalizeEvaluations(rawEvaluations as Record<string, unknown>[]),
    summary: normalizeSummary(rawSummary as Record<string, unknown>[]),
  };
}
