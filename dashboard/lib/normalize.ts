/**
 * Data normalization layer
 * Ensures consistent field names regardless of source (SQLite, Excel, JSON)
 * Handles: companies, people, mails, audits, evaluations
 */

// ============================================================
// TYPES
// ============================================================

export interface NormalizedCompany {
  mapp: string;
  kungorelse_id: string;
  foretagsnamn: string;
  orgnr: string;
  registreringsdatum: string | null;
  publiceringsdatum: string | null;
  lan: string | null;
  sate: string | null;
  postadress: string | null;
  epost: string | null;
  typ: string | null;
  bildat: string | null;
  verksamhet: string | null;
  rakenskapsar: string | null;
  aktiekapital: string | null;
  antal_aktier: number | string | null;
  firmateckning: string | null;
  styrelseledamoter: string | null;
  styrelsesuppleanter: string | null;
  styrelse_ovrigt: string | null;
  segment: string | null;
  kalla_url: string | null;
  // Research/enrichment
  domain_guess: string | null;
  domain_verified: string | null;
  domain_confidence: number | null;
  domain_status: string | null;
  emails_found: string | null;
  phones_found: string | null;
  people_count: number | null;
  research_done: string | null;
  // Evaluation
  ska_fa_sajt: string | null;
  konfidens: string | null;
  preview_url: string | null;
  audit_link: string | null;
}

export interface NormalizedPerson {
  kungorelse_id: string;  // Maps to company via mapp
  foretagsnamn: string;
  orgnr: string;
  roll: string | null;
  personnummer: string | null;
  efternamn: string | null;
  fornamn: string | null;
  mellannamn: string | null;
  adress: string | null;
  postnummer: string | null;
  ort: string | null;
}

export interface NormalizedMail {
  folder: string;  // Maps to company via mapp
  company: string;
  email: string;
  subject: string;
  mail_content: string | null;
  cost_sek: number | null;
  domain_status: string | null;
  site_preview_url: string | null;
  audit_note: string | null;
}

export interface NormalizedAudit {
  mapp: string;  // Maps to company
  foretagsnamn: string;
  hemsida: string | null;
  audit_datum: string | null;
  bransch: string | null;
  // Ratings (0-10)
  helhet: number | null;
  design: number | null;
  innehall: number | null;
  anvandbarhet: number | null;
  mobil: number | null;
  seo: number | null;
  // Text feedback
  styrkor: string | null;
  svagheter: string | null;
  rekommendationer: string | null;
}

export interface NormalizedEvaluation {
  kungorelse_id: string;
  foretagsnamn: string;
  ska_fa_sajt: string | null;
  konfidens: string | null;
  motivering: string | null;
  preview_url: string | null;
}

export interface NormalizedSummary {
  datum: string | null;
  skapad: string | null;
  totalt_antal_foretag: number | null;
  med_doman: number | null;
  mail_genererade: number | null;
  bedomda_foretag: number | null;
  varda_foretag: number | null;
  med_preview_url: number | null;
}

// Full normalized data structure
export interface NormalizedData {
  companies: NormalizedCompany[];
  people: NormalizedPerson[];
  mails: NormalizedMail[];
  audits: NormalizedAudit[];
  evaluations: NormalizedEvaluation[];
  summary: NormalizedSummary | null;
}

// ============================================================
// FIELD MAPPINGS
// ============================================================

const COMPANY_FIELD_MAP: Record<string, keyof NormalizedCompany> = {
  // Swedish Excel columns
  "Mapp": "mapp",
  "Kungörelse-id": "kungorelse_id",
  "Företagsnamn": "foretagsnamn",
  "Org.nr": "orgnr",
  "Registreringsdatum": "registreringsdatum",
  "Publiceringsdatum": "publiceringsdatum",
  "Län": "lan",
  "Säte": "sate",
  "Postadress": "postadress",
  "E-post": "epost",
  "Typ": "typ",
  "Bildat": "bildat",
  "Verksamhet": "verksamhet",
  "Räkenskapsår": "rakenskapsar",
  "Aktiekapital": "aktiekapital",
  "Antal aktier": "antal_aktier",
  "Firmateckning": "firmateckning",
  "Styrelseledamöter": "styrelseledamoter",
  "Styrelsesuppleanter": "styrelsesuppleanter",
  "Styrelse (övrigt)": "styrelse_ovrigt",
  "Segment": "segment",
  "Källa URL": "kalla_url",
  "Ska få sajt": "ska_fa_sajt",
  "Konfidens": "konfidens",
  "Preview URL": "preview_url",
  "Audit Link": "audit_link",
  // Research fields
  "domain_guess": "domain_guess",
  "domain_verified": "domain_verified",
  "domain_confidence": "domain_confidence",
  "domain_status": "domain_status",
  "emails_found": "emails_found",
  "phones_found": "phones_found",
  "people_count": "people_count",
  "research_done": "research_done",
  // SQLite snake_case
  "kungorelse_id": "kungorelse_id",
  "mapp": "mapp",
  "foretagsnamn": "foretagsnamn",
  "orgnr": "orgnr",
  "registreringsdatum": "registreringsdatum",
  "publiceringsdatum": "publiceringsdatum",
  "lan": "lan",
  "sate": "sate",
  "postadress": "postadress",
  "epost": "epost",
  "typ": "typ",
  "bildat": "bildat",
  "verksamhet": "verksamhet",
  "rakenskapsar": "rakenskapsar",
  "aktiekapital": "aktiekapital",
  "antal_aktier": "antal_aktier",
  "firmateckning": "firmateckning",
  "styrelseledamoter": "styrelseledamoter",
  "styrelsesuppleanter": "styrelsesuppleanter",
  "styrelse_ovrigt": "styrelse_ovrigt",
  "segment": "segment",
  "kalla_url": "kalla_url",
};

const PERSON_FIELD_MAP: Record<string, keyof NormalizedPerson> = {
  "Kungörelse-id": "kungorelse_id",
  "Företagsnamn": "foretagsnamn",
  "Org.nr": "orgnr",
  "Roll": "roll",
  "Personnummer": "personnummer",
  "Efternamn": "efternamn",
  "Förnamn": "fornamn",
  "Mellannamn": "mellannamn",
  "Adress": "adress",
  "Postnummer": "postnummer",
  "Ort": "ort",
  // snake_case
  "kungorelse_id": "kungorelse_id",
  "foretagsnamn": "foretagsnamn",
  "orgnr": "orgnr",
  "roll": "roll",
  "personnummer": "personnummer",
  "efternamn": "efternamn",
  "fornamn": "fornamn",
  "mellannamn": "mellannamn",
  "adress": "adress",
  "postnummer": "postnummer",
  "ort": "ort",
  "titel": "roll",
};

const MAIL_FIELD_MAP: Record<string, keyof NormalizedMail> = {
  "folder": "folder",
  "company": "company",
  "email": "email",
  "subject": "subject",
  "mail_content": "mail_content",
  "cost_sek": "cost_sek",
  "domain_status": "domain_status",
  "site_preview_url": "site_preview_url",
  "audit_note": "audit_note",
  // Swedish alternatives
  "Företagsnamn": "company",
  "E-post": "email",
  "Email": "email",
  "Ämne": "subject",
  "Mail-text": "mail_content",
  "Status": "domain_status",
};

const AUDIT_FIELD_MAP: Record<string, keyof NormalizedAudit> = {
  "Mapp": "mapp",
  "Företag": "foretagsnamn",
  "Hemsida": "hemsida",
  "Audit-datum": "audit_datum",
  "Bransch": "bransch",
  "Helhet": "helhet",
  "Design": "design",
  "Innehåll": "innehall",
  "Användbarhet": "anvandbarhet",
  "Mobil": "mobil",
  "SEO": "seo",
  "Styrkor": "styrkor",
  "Svagheter": "svagheter",
  "Rekommendationer": "rekommendationer",
  // snake_case
  "mapp": "mapp",
  "foretagsnamn": "foretagsnamn",
  "hemsida": "hemsida",
};

const EVALUATION_FIELD_MAP: Record<string, keyof NormalizedEvaluation> = {
  "Kungörelse-id": "kungorelse_id",
  "Företagsnamn": "foretagsnamn",
  "Ska få sajt": "ska_fa_sajt",
  "Konfidens": "konfidens",
  "Motivering": "motivering",
  "Preview URL": "preview_url",
};

// ============================================================
// HELPERS
// ============================================================

function normalizeValue(value: unknown): string | number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "Ja" : "Nej";
  }
  return String(value).trim() || null;
}

function asString(value: unknown): string | null {
  const v = normalizeValue(value);
  return v === null ? null : String(v);
}

function asNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = parseFloat(String(value).replace(",", "."));
  return isNaN(parsed) ? null : parsed;
}

// ============================================================
// NORMALIZERS
// ============================================================

export function normalizeCompany(raw: Record<string, unknown>): NormalizedCompany {
  const result: Partial<NormalizedCompany> = {};

  for (const [sourceKey, targetKey] of Object.entries(COMPANY_FIELD_MAP)) {
    if (sourceKey in raw) {
      const value = normalizeValue(raw[sourceKey]);
      (result as Record<string, unknown>)[targetKey] = value;
    }
  }

  return {
    mapp: asString(result.mapp) ?? "",
    kungorelse_id: asString(result.kungorelse_id) ?? "",
    foretagsnamn: asString(result.foretagsnamn) ?? "",
    orgnr: asString(result.orgnr) ?? "",
    registreringsdatum: asString(result.registreringsdatum),
    publiceringsdatum: asString(result.publiceringsdatum),
    lan: asString(result.lan),
    sate: asString(result.sate),
    postadress: asString(result.postadress),
    epost: asString(result.epost),
    typ: asString(result.typ),
    bildat: asString(result.bildat),
    verksamhet: asString(result.verksamhet),
    rakenskapsar: asString(result.rakenskapsar),
    aktiekapital: asString(result.aktiekapital),
    antal_aktier: result.antal_aktier ?? null,
    firmateckning: asString(result.firmateckning),
    styrelseledamoter: asString(result.styrelseledamoter),
    styrelsesuppleanter: asString(result.styrelsesuppleanter),
    styrelse_ovrigt: asString(result.styrelse_ovrigt),
    segment: asString(result.segment),
    kalla_url: asString(result.kalla_url),
    domain_guess: asString(result.domain_guess),
    domain_verified: asString(result.domain_verified),
    domain_confidence: asNumber(result.domain_confidence),
    domain_status: asString(result.domain_status),
    emails_found: asString(result.emails_found),
    phones_found: asString(result.phones_found),
    people_count: asNumber(result.people_count),
    research_done: asString(result.research_done),
    ska_fa_sajt: asString(result.ska_fa_sajt),
    konfidens: asString(result.konfidens),
    preview_url: asString(result.preview_url),
    audit_link: asString(result.audit_link),
  };
}

export function normalizePerson(raw: Record<string, unknown>): NormalizedPerson {
  const result: Partial<NormalizedPerson> = {};

  for (const [sourceKey, targetKey] of Object.entries(PERSON_FIELD_MAP)) {
    if (sourceKey in raw) {
      const value = normalizeValue(raw[sourceKey]);
      (result as Record<string, unknown>)[targetKey] = value;
    }
  }

  return {
    kungorelse_id: asString(result.kungorelse_id) ?? "",
    foretagsnamn: asString(result.foretagsnamn) ?? "",
    orgnr: asString(result.orgnr) ?? "",
    roll: asString(result.roll),
    personnummer: asString(result.personnummer),
    efternamn: asString(result.efternamn),
    fornamn: asString(result.fornamn),
    mellannamn: asString(result.mellannamn),
    adress: asString(result.adress),
    postnummer: asString(result.postnummer),
    ort: asString(result.ort),
  };
}

export function normalizeMail(raw: Record<string, unknown>): NormalizedMail {
  const result: Partial<NormalizedMail> = {};

  for (const [sourceKey, targetKey] of Object.entries(MAIL_FIELD_MAP)) {
    if (sourceKey in raw) {
      const value = normalizeValue(raw[sourceKey]);
      (result as Record<string, unknown>)[targetKey] = value;
    }
  }

  return {
    folder: asString(result.folder) ?? "",
    company: asString(result.company) ?? "",
    email: asString(result.email) ?? "",
    subject: asString(result.subject) ?? "",
    mail_content: asString(result.mail_content),
    cost_sek: asNumber(result.cost_sek),
    domain_status: asString(result.domain_status),
    site_preview_url: asString(result.site_preview_url),
    audit_note: asString(result.audit_note),
  };
}

export function normalizeAudit(raw: Record<string, unknown>): NormalizedAudit {
  const result: Partial<NormalizedAudit> = {};

  for (const [sourceKey, targetKey] of Object.entries(AUDIT_FIELD_MAP)) {
    if (sourceKey in raw) {
      const value = normalizeValue(raw[sourceKey]);
      (result as Record<string, unknown>)[targetKey] = value;
    }
  }

  return {
    mapp: asString(result.mapp) ?? "",
    foretagsnamn: asString(result.foretagsnamn) ?? "",
    hemsida: asString(result.hemsida),
    audit_datum: asString(result.audit_datum),
    bransch: asString(result.bransch),
    helhet: asNumber(result.helhet),
    design: asNumber(result.design),
    innehall: asNumber(result.innehall),
    anvandbarhet: asNumber(result.anvandbarhet),
    mobil: asNumber(result.mobil),
    seo: asNumber(result.seo),
    styrkor: asString(result.styrkor),
    svagheter: asString(result.svagheter),
    rekommendationer: asString(result.rekommendationer),
  };
}

export function normalizeEvaluation(raw: Record<string, unknown>): NormalizedEvaluation {
  const result: Partial<NormalizedEvaluation> = {};

  for (const [sourceKey, targetKey] of Object.entries(EVALUATION_FIELD_MAP)) {
    if (sourceKey in raw) {
      const value = normalizeValue(raw[sourceKey]);
      (result as Record<string, unknown>)[targetKey] = value;
    }
  }

  return {
    kungorelse_id: asString(result.kungorelse_id) ?? "",
    foretagsnamn: asString(result.foretagsnamn) ?? "",
    ska_fa_sajt: asString(result.ska_fa_sajt),
    konfidens: asString(result.konfidens),
    motivering: asString(result.motivering),
    preview_url: asString(result.preview_url),
  };
}

export function normalizeSummary(rows: Record<string, unknown>[]): NormalizedSummary | null {
  if (!rows || rows.length === 0) return null;
  
  const summary: NormalizedSummary = {
    datum: null,
    skapad: null,
    totalt_antal_foretag: null,
    med_doman: null,
    mail_genererade: null,
    bedomda_foretag: null,
    varda_foretag: null,
    med_preview_url: null,
  };

  for (const row of rows) {
    const key = asString(row["Nyckel"] || row["nyckel"]);
    const value = row["Värde"] || row["varde"];
    
    if (!key) continue;
    
    const keyLower = key.toLowerCase();
    if (keyLower === "datum") summary.datum = asString(value);
    else if (keyLower === "skapad") summary.skapad = asString(value);
    else if (keyLower.includes("totalt antal företag")) summary.totalt_antal_foretag = asNumber(value);
    else if (keyLower === "med domän") summary.med_doman = asNumber(value);
    else if (keyLower === "mail genererade") summary.mail_genererade = asNumber(value);
    else if (keyLower === "bedömda företag") summary.bedomda_foretag = asNumber(value);
    else if (keyLower.includes("värda företag")) summary.varda_foretag = asNumber(value);
    else if (keyLower.includes("preview-url")) summary.med_preview_url = asNumber(value);
  }

  return summary;
}

// ============================================================
// BATCH NORMALIZERS
// ============================================================

export function normalizeCompanies(rows: Record<string, unknown>[]): NormalizedCompany[] {
  return rows.map(normalizeCompany);
}

export function normalizePeople(rows: Record<string, unknown>[]): NormalizedPerson[] {
  return rows.map(normalizePerson);
}

export function normalizeMails(rows: Record<string, unknown>[]): NormalizedMail[] {
  return rows.map(normalizeMail);
}

export function normalizeAudits(rows: Record<string, unknown>[]): NormalizedAudit[] {
  return rows.map(normalizeAudit);
}

export function normalizeEvaluations(rows: Record<string, unknown>[]): NormalizedEvaluation[] {
  return rows.map(normalizeEvaluation);
}

// ============================================================
// STATS
// ============================================================

export interface DataStats {
  totalCompanies: number;
  totalPeople: number;
  totalMails: number;
  totalAudits: number;
  totalEvaluations: number;
  hasPeopleData: boolean;
  hasMailData: boolean;
  hasAuditData: boolean;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  companiesWithPreview: number;
  companiesWorthySite: number;
  uniquePeople: number;
  boardMembers: number;
  deputies: number;
  uniqueCities: number;
  segments: Record<string, number>;
  lans: Record<string, number>;
  domainStatuses: Record<string, number>;
}

export function calculateStats(data: NormalizedData): DataStats {
  const { companies, people, mails, audits, evaluations } = data;
  
  const segments: Record<string, number> = {};
  const lans: Record<string, number> = {};
  const domainStatuses: Record<string, number> = {};

  companies.forEach((c) => {
    const segment = c.segment || "Okänt";
    segments[segment] = (segments[segment] || 0) + 1;

    const lan = c.lan || "Okänt";
    lans[lan] = (lans[lan] || 0) + 1;
    
    const status = c.domain_status || "unknown";
    domainStatuses[status] = (domainStatuses[status] || 0) + 1;
  });

  // Count from mails too
  mails.forEach((m) => {
    const status = m.domain_status || "unknown";
    domainStatuses[status] = (domainStatuses[status] || 0) + 1;
  });

  return {
    totalCompanies: companies.length,
    totalPeople: people.length,
    totalMails: mails.length,
    totalAudits: audits.length,
    totalEvaluations: evaluations.length,
    hasPeopleData: people.length > 0,
    hasMailData: mails.length > 0,
    hasAuditData: audits.length > 0,
    companiesWithDomain: companies.filter((c) => c.domain_verified).length,
    companiesWithEmail: companies.filter((c) => c.epost || c.emails_found).length,
    companiesWithPhone: companies.filter((c) => c.phones_found).length,
    companiesWithPreview: companies.filter((c) => c.preview_url).length + mails.filter((m) => m.site_preview_url).length,
    companiesWorthySite: companies.filter((c) => c.ska_fa_sajt?.toLowerCase() === "ja").length,
    uniquePeople: new Set(people.map((p) => p.personnummer).filter(Boolean)).size,
    boardMembers: people.filter((p) => p.roll?.includes("Styrelseledamot")).length,
    deputies: people.filter((p) => p.roll?.includes("Styrelsesuppleant")).length,
    uniqueCities: new Set(people.map((p) => p.ort).filter(Boolean)).size,
    segments,
    lans,
    domainStatuses,
  };
}

// ============================================================
// SHEET NAME HELPERS
// ============================================================

export function findSheetByNames(
  sheets: Record<string, unknown[]>,
  names: string[]
): unknown[] {
  for (const name of names) {
    if (sheets[name] && (sheets[name] as unknown[]).length > 0) {
      return sheets[name] as unknown[];
    }
  }
  return [];
}

export const COMPANY_SHEET_NAMES = ["Huvuddata", "Data", "Companies", "companies"];
export const PEOPLE_SHEET_NAMES = ["Personer", "People", "Styrelse", "personer"];
export const MAIL_SHEET_NAMES = ["Mails", "Mail", "mails", "mail"];
export const AUDIT_SHEET_NAMES = ["Audits", "audits", "Audit"];
export const EVALUATION_SHEET_NAMES = ["Evaluation", "Evaluations", "evaluation"];
export const SUMMARY_SHEET_NAMES = ["Sammanfattning", "Summary", "sammanfattning"];
