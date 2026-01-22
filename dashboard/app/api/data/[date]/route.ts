import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { readdirSync } from "fs";
import { isAuthenticated } from "@/lib/auth";
import Database from "better-sqlite3";
import { parseExcelFile } from "@/lib/excel";
import { getExistingDateDir } from "@/lib/data-paths";
import {
  normalizeCompanies,
  normalizePeople,
  normalizeMails,
  normalizeAudits,
  normalizeEvaluations,
  normalizeSummary,
  calculateStats,
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date } = await params;

    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const dateDir = await getExistingDateDir(date);
    if (!dateDir) {
      return NextResponse.json(
        { error: "Data not found for this date" },
        { status: 404 }
      );
    }

    // Initialize data structure
    const data: NormalizedData = {
      companies: [],
      people: [],
      mails: [],
      audits: [],
      evaluations: [],
      summary: null,
    };

    let source = "unknown";

    // Find and process all data files
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
        
        // Merge data (avoid duplicates by checking if we already have data)
        if (xlsxData.companies.length > 0) {
          // If from final_*.xlsx or kungorelser_*.xlsx, these are the main company sources
          if (file.includes("final") || file.includes("kungorelser")) {
            if (data.companies.length === 0) {
              data.companies = xlsxData.companies;
            }
          }
        }
        
        if (xlsxData.people.length > 0 && data.people.length === 0) {
          data.people = xlsxData.people;
        }
        
        // Always add mails and audits (these are additive)
        data.mails.push(...xlsxData.mails);
        data.audits.push(...xlsxData.audits);
        
        if (xlsxData.evaluations.length > 0 && data.evaluations.length === 0) {
          data.evaluations = xlsxData.evaluations;
        }
        
        if (xlsxData.summary && !data.summary) {
          data.summary = xlsxData.summary;
        }
        
        if (source === "unknown") {
          source = file.includes("final") ? "excel-final" : 
                   file.includes("mail_ready") ? "excel-mail" : "excel";
        }
      }
    }

    // Deduplicate mails and audits by key
    data.mails = deduplicateByKey(data.mails, "folder");
    data.audits = deduplicateByKey(data.audits, "mapp");

    const stats = calculateStats(data);

    return NextResponse.json({
      date,
      stats,
      companies: data.companies,
      people: data.people,
      mails: data.mails,
      audits: data.audits,
      evaluations: data.evaluations,
      summary: data.summary,
      source,
    });
  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

function deduplicateByKey<T extends Record<string, unknown>>(items: T[], key: string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = String(item[key] || "");
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

  // Find company data
  let rawCompanies = findSheetByNames(sheets, COMPANY_SHEET_NAMES);
  if (rawCompanies.length === 0 && sheetNames.length > 0) {
    // Use first sheet as fallback for kungorelser files
    if (fileName.includes("kungorelser")) {
      rawCompanies = sheets[sheetNames[0]] || [];
    }
  }

  // Find people data
  const rawPeople = findSheetByNames(sheets, PEOPLE_SHEET_NAMES);

  // Find mail data
  const rawMails = findSheetByNames(sheets, MAIL_SHEET_NAMES);

  // Find audit data
  const rawAudits = findSheetByNames(sheets, AUDIT_SHEET_NAMES);

  // Find evaluation data
  const rawEvaluations = findSheetByNames(sheets, EVALUATION_SHEET_NAMES);

  // Find summary data
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
