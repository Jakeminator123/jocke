import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { PERSISTENT_DISK_DIR, LOCAL_DATA_DIR } from "@/lib/data-paths";
import type { NormalizedData } from "@/lib/normalize";

const INDEX_DB_NAME = "_index.sqlite";

function getIndexBaseDir(): string {
  return existsSync(PERSISTENT_DISK_DIR) ? PERSISTENT_DISK_DIR : LOCAL_DATA_DIR;
}

export function getIndexDbPath(): string {
  return join(getIndexBaseDir(), INDEX_DB_NAME);
}

export function isIndexAvailable(): boolean {
  return existsSync(getIndexDbPath());
}

export function ensureIndexDb() {
  const baseDir = getIndexBaseDir();
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  const db = new Database(getIndexDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS indexed_dates (
      date TEXT PRIMARY KEY,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS companies (
      date TEXT,
      mapp TEXT,
      orgnr TEXT,
      foretagsnamn TEXT,
      segment TEXT,
      lan TEXT,
      epost TEXT,
      emails_found TEXT,
      domain_verified TEXT,
      domain_guess TEXT,
      domain_status TEXT,
      phones_found TEXT,
      ska_fa_sajt TEXT,
      preview_url TEXT,
      search_text TEXT
    );

    CREATE TABLE IF NOT EXISTS people (
      date TEXT,
      mapp TEXT,
      kungorelse_id TEXT,
      foretagsnamn TEXT,
      orgnr TEXT,
      roll TEXT,
      personnummer TEXT,
      ort TEXT,
      search_text TEXT
    );

    CREATE TABLE IF NOT EXISTS mails (
      date TEXT,
      mapp TEXT,
      folder TEXT,
      company TEXT,
      email TEXT,
      subject TEXT,
      domain_status TEXT,
      mail_status TEXT,
      site_preview_url TEXT
    );

    CREATE TABLE IF NOT EXISTS audits (
      date TEXT,
      mapp TEXT,
      foretagsnamn TEXT,
      hemsida TEXT,
      audit_datum TEXT,
      bransch TEXT,
      helhet REAL,
      design REAL,
      innehall REAL,
      anvandbarhet REAL,
      mobil REAL,
      seo REAL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      date TEXT,
      mapp TEXT,
      kungorelse_id TEXT,
      foretagsnamn TEXT,
      ska_fa_sajt TEXT,
      konfidens TEXT,
      preview_url TEXT
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_companies_date ON companies(date);
    CREATE INDEX IF NOT EXISTS idx_companies_mapp ON companies(mapp);
    CREATE INDEX IF NOT EXISTS idx_companies_orgnr ON companies(orgnr);
    CREATE INDEX IF NOT EXISTS idx_companies_segment ON companies(segment);
    CREATE INDEX IF NOT EXISTS idx_companies_lan ON companies(lan);
    CREATE INDEX IF NOT EXISTS idx_companies_search ON companies(search_text);

    CREATE INDEX IF NOT EXISTS idx_people_date ON people(date);
    CREATE INDEX IF NOT EXISTS idx_people_search ON people(search_text);
    CREATE INDEX IF NOT EXISTS idx_people_mapp ON people(mapp);

    CREATE INDEX IF NOT EXISTS idx_mails_date ON mails(date);
    CREATE INDEX IF NOT EXISTS idx_mails_mapp ON mails(mapp);

    CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(date);
    CREATE INDEX IF NOT EXISTS idx_audits_mapp ON audits(mapp);

    CREATE INDEX IF NOT EXISTS idx_evaluations_date ON evaluations(date);
    CREATE INDEX IF NOT EXISTS idx_evaluations_mapp ON evaluations(mapp);
  `);

  return db;
}

export function indexDateData(date: string, data: NormalizedData): void {
  const db = ensureIndexDb();
  const now = new Date().toISOString();

  const deleteByDate = db.prepare("DELETE FROM companies WHERE date = ?").run.bind(db);
  const deletePeople = db.prepare("DELETE FROM people WHERE date = ?").run.bind(db);
  const deleteMails = db.prepare("DELETE FROM mails WHERE date = ?").run.bind(db);
  const deleteAudits = db.prepare("DELETE FROM audits WHERE date = ?").run.bind(db);
  const deleteEvaluations = db.prepare("DELETE FROM evaluations WHERE date = ?").run.bind(db);

  const insertCompany = db.prepare(`
    INSERT INTO companies (
      date, mapp, orgnr, foretagsnamn, segment, lan, epost, emails_found,
      domain_verified, domain_guess, domain_status, phones_found,
      ska_fa_sajt, preview_url, search_text
    ) VALUES (
      @date, @mapp, @orgnr, @foretagsnamn, @segment, @lan, @epost, @emails_found,
      @domain_verified, @domain_guess, @domain_status, @phones_found,
      @ska_fa_sajt, @preview_url, @search_text
    )
  `);

  const insertPerson = db.prepare(`
    INSERT INTO people (
      date, mapp, kungorelse_id, foretagsnamn, orgnr, roll, personnummer, ort, search_text
    ) VALUES (
      @date, @mapp, @kungorelse_id, @foretagsnamn, @orgnr, @roll, @personnummer, @ort, @search_text
    )
  `);

  const insertMail = db.prepare(`
    INSERT INTO mails (
      date, mapp, folder, company, email, subject, domain_status, mail_status, site_preview_url
    ) VALUES (
      @date, @mapp, @folder, @company, @email, @subject, @domain_status, @mail_status, @site_preview_url
    )
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audits (
      date, mapp, foretagsnamn, hemsida, audit_datum, bransch,
      helhet, design, innehall, anvandbarhet, mobil, seo
    ) VALUES (
      @date, @mapp, @foretagsnamn, @hemsida, @audit_datum, @bransch,
      @helhet, @design, @innehall, @anvandbarhet, @mobil, @seo
    )
  `);

  const insertEvaluation = db.prepare(`
    INSERT INTO evaluations (
      date, mapp, kungorelse_id, foretagsnamn, ska_fa_sajt, konfidens, preview_url
    ) VALUES (
      @date, @mapp, @kungorelse_id, @foretagsnamn, @ska_fa_sajt, @konfidens, @preview_url
    )
  `);

  const updateDate = db.prepare(`
    INSERT INTO indexed_dates (date, updated_at)
    VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET updated_at = excluded.updated_at
  `);

  const transaction = db.transaction(() => {
    deleteByDate(date);
    deletePeople(date);
    deleteMails(date);
    deleteAudits(date);
    deleteEvaluations(date);

    data.companies.forEach((company) => {
      insertCompany.run({
        date,
        mapp: company.mapp || "",
        orgnr: company.orgnr || "",
        foretagsnamn: company.foretagsnamn || "",
        segment: company.segment || "",
        lan: company.lan || "",
        epost: company.epost || "",
        emails_found: company.emails_found || "",
        domain_verified: company.domain_verified || "",
        domain_guess: company.domain_guess || "",
        domain_status: company.domain_status || "",
        phones_found: company.phones_found || "",
        ska_fa_sajt: company.ska_fa_sajt || "",
        preview_url: company.preview_url || "",
        search_text: buildSearchText([
          company.foretagsnamn,
          company.orgnr,
          company.mapp,
          company.segment,
          company.lan,
          company.epost,
          company.emails_found,
          company.verksamhet,
        ]),
      });
    });

    data.people.forEach((person) => {
      insertPerson.run({
        date,
        mapp: person.mapp || "",
        kungorelse_id: person.kungorelse_id || "",
        foretagsnamn: person.foretagsnamn || "",
        orgnr: person.orgnr || "",
        roll: person.roll || "",
        personnummer: person.personnummer || "",
        ort: person.ort || "",
        search_text: buildSearchText([
          person.fornamn,
          person.mellannamn,
          person.efternamn,
          person.foretagsnamn,
          person.orgnr,
          person.kungorelse_id,
          person.mapp,
          person.roll,
          person.ort,
        ]),
      });
    });

    data.mails.forEach((mail) => {
      insertMail.run({
        date,
        mapp: mail.mapp || "",
        folder: mail.folder || "",
        company: mail.company || "",
        email: mail.email || "",
        subject: mail.subject || "",
        domain_status: mail.domain_status || "",
        mail_status: mail.mail_status || "",
        site_preview_url: mail.site_preview_url || "",
      });
    });

    data.audits.forEach((audit) => {
      insertAudit.run({
        date,
        mapp: audit.mapp || "",
        foretagsnamn: audit.foretagsnamn || "",
        hemsida: audit.hemsida || "",
        audit_datum: audit.audit_datum || "",
        bransch: audit.bransch || "",
        helhet: audit.helhet ?? null,
        design: audit.design ?? null,
        innehall: audit.innehall ?? null,
        anvandbarhet: audit.anvandbarhet ?? null,
        mobil: audit.mobil ?? null,
        seo: audit.seo ?? null,
      });
    });

    data.evaluations.forEach((evaluation) => {
      insertEvaluation.run({
        date,
        mapp: evaluation.mapp || "",
        kungorelse_id: evaluation.kungorelse_id || "",
        foretagsnamn: evaluation.foretagsnamn || "",
        ska_fa_sajt: evaluation.ska_fa_sajt || "",
        konfidens: evaluation.konfidens || "",
        preview_url: evaluation.preview_url || "",
      });
    });

    updateDate.run(date, now);
  });

  transaction();
  db.close();
}

export function getIndexedDates(): Set<string> {
  if (!isIndexAvailable()) return new Set();
  const db = ensureIndexDb();
  const rows = db.prepare("SELECT date FROM indexed_dates").all() as { date: string }[];
  db.close();
  return new Set(rows.map((row) => row.date));
}

function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
