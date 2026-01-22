import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync } from "fs";
import { isAuthenticated } from "@/lib/auth";
import Database from "better-sqlite3";
import { parseExcelFile } from "@/lib/excel";
import { getExistingDateDir } from "@/lib/data-paths";
import {
  normalizeCompanies,
  normalizePeople,
  calculateStats,
  type NormalizedCompany,
  type NormalizedPerson,
} from "@/lib/normalize";

export async function GET(
  request: NextRequest,
  { params }: { params: { date: string } }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { date } = params;

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

    // Priority: companies_*.db > data.db > final_*.xlsx > jocke.xlsx > kungorelser_*.xlsx
    const companiesDbPath = join(dateDir, `companies_${date}.db`);
    const dbPath = join(dateDir, "data.db");
    const finalExcelPath = join(dateDir, `final_${date}.xlsx`);
    const jockePath = join(dateDir, "jocke.xlsx");
    const excelPath = join(dateDir, `kungorelser_${date}.xlsx`);

    let companies: NormalizedCompany[] = [];
    let people: NormalizedPerson[] = [];
    let source = "unknown";

    if (existsSync(companiesDbPath)) {
      const result = getDataFromSQLite(companiesDbPath);
      companies = result.companies;
      people = result.people;
      source = "sqlite";
    } else if (existsSync(dbPath)) {
      const result = getDataFromSQLite(dbPath);
      companies = result.companies;
      people = result.people;
      source = "sqlite";
    } else if (existsSync(finalExcelPath)) {
      const result = await getDataFromExcel(finalExcelPath);
      companies = result.companies;
      people = result.people;
      source = "excel-final";
    } else if (existsSync(jockePath)) {
      const result = await getDataFromExcel(jockePath);
      companies = result.companies;
      people = result.people;
      source = "excel-jocke";
    } else if (existsSync(excelPath)) {
      const result = await getDataFromExcel(excelPath);
      companies = result.companies;
      people = result.people;
      source = "excel-kungorelser";
    } else {
      return NextResponse.json(
        { error: "Data not found for this date" },
        { status: 404 }
      );
    }

    const stats = calculateStats(companies, people);

    return NextResponse.json({
      date,
      stats,
      companies,
      people,
      source,
    });
  } catch (error) {
    console.error("Error reading data:", error);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

function getDataFromSQLite(dbPath: string): {
  companies: NormalizedCompany[];
  people: NormalizedPerson[];
} {
  const db = new Database(dbPath, { readonly: true });

  // Get table names to handle different schemas
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[];
  const tableNames = tables.map((t) => t.name);

  let rawCompanies: Record<string, unknown>[] = [];
  let rawPeople: Record<string, unknown>[] = [];

  // Try different table names for companies
  if (tableNames.includes("companies")) {
    rawCompanies = db.prepare("SELECT * FROM companies").all() as Record<string, unknown>[];
  }

  // Try different table names for people
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

async function getDataFromExcel(filePath: string): Promise<{
  companies: NormalizedCompany[];
  people: NormalizedPerson[];
}> {
  const { sheets, sheetNames } = await parseExcelFile(filePath);

  // Find company data - try multiple sheet names
  let rawCompanies: Record<string, unknown>[] = [];
  const companySheetNames = ["Huvuddata", "Data", "Companies", sheetNames[0]];
  for (const name of companySheetNames) {
    if (name && sheets[name] && (sheets[name] as unknown[]).length > 0) {
      rawCompanies = sheets[name] as Record<string, unknown>[];
      break;
    }
  }

  // Find people data
  let rawPeople: Record<string, unknown>[] = [];
  const peopleSheetNames = ["Personer", "People", "Styrelse"];
  for (const name of peopleSheetNames) {
    if (sheets[name] && (sheets[name] as unknown[]).length > 0) {
      rawPeople = sheets[name] as Record<string, unknown>[];
      break;
    }
  }

  return {
    companies: normalizeCompanies(rawCompanies),
    people: normalizePeople(rawPeople),
  };
}
