/**
 * Data normalization layer
 * Ensures consistent field names regardless of source (SQLite, Excel, JSON)
 */

// Normalized company type - stable fields for UI
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
  // Research/enrichment fields
  domain_guess: string | null;
  domain_verified: string | null;
  domain_confidence: number | null;
  domain_status: string | null;
  emails_found: string | null;
  phones_found: string | null;
  people_count: number | null;
  research_done: string | null;
  // Evaluation fields (from final.xlsx)
  ska_fa_sajt: string | null;
  konfidens: string | null;
  preview_url: string | null;
}

// Normalized person type
export interface NormalizedPerson {
  kungorelse_id: string;
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

// Field mappings: Excel column name -> normalized field name
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
  // Research fields (already snake_case in some sources)
  "domain_guess": "domain_guess",
  "domain_verified": "domain_verified",
  "domain_confidence": "domain_confidence",
  "domain_status": "domain_status",
  "emails_found": "emails_found",
  "phones_found": "phones_found",
  "people_count": "people_count",
  "research_done": "research_done",
  // Evaluation fields from final.xlsx
  "Ska få sajt": "ska_fa_sajt",
  "Konfidens": "konfidens",
  "Preview URL": "preview_url",
  // SQLite snake_case columns (direct mapping)
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
  // SQLite snake_case
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
  "titel": "roll", // SQLite may use 'titel' instead of 'roll'
};

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

export function normalizeCompany(raw: Record<string, unknown>): NormalizedCompany {
  const result: Partial<NormalizedCompany> = {};

  // Map known fields
  for (const [sourceKey, targetKey] of Object.entries(COMPANY_FIELD_MAP)) {
    if (sourceKey in raw) {
      const value = normalizeValue(raw[sourceKey]);
      (result as Record<string, unknown>)[targetKey] = value;
    }
  }

  // Ensure required fields have defaults
  return {
    mapp: result.mapp ?? "",
    kungorelse_id: result.kungorelse_id ?? "",
    foretagsnamn: result.foretagsnamn ?? "",
    orgnr: result.orgnr ?? "",
    registreringsdatum: result.registreringsdatum ?? null,
    publiceringsdatum: result.publiceringsdatum ?? null,
    lan: result.lan ?? null,
    sate: result.sate ?? null,
    postadress: result.postadress ?? null,
    epost: result.epost ?? null,
    typ: result.typ ?? null,
    bildat: result.bildat ?? null,
    verksamhet: result.verksamhet ?? null,
    rakenskapsar: result.rakenskapsar ?? null,
    aktiekapital: result.aktiekapital ?? null,
    antal_aktier: result.antal_aktier ?? null,
    firmateckning: result.firmateckning ?? null,
    styrelseledamoter: result.styrelseledamoter ?? null,
    styrelsesuppleanter: result.styrelsesuppleanter ?? null,
    styrelse_ovrigt: result.styrelse_ovrigt ?? null,
    segment: result.segment ?? null,
    kalla_url: result.kalla_url ?? null,
    domain_guess: result.domain_guess ?? null,
    domain_verified: result.domain_verified ?? null,
    domain_confidence: typeof result.domain_confidence === "number" ? result.domain_confidence : null,
    domain_status: result.domain_status ?? null,
    emails_found: result.emails_found ?? null,
    phones_found: result.phones_found ?? null,
    people_count: typeof result.people_count === "number" ? result.people_count : null,
    research_done: result.research_done ?? null,
    ska_fa_sajt: result.ska_fa_sajt ?? null,
    konfidens: result.konfidens ?? null,
    preview_url: result.preview_url ?? null,
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
    kungorelse_id: result.kungorelse_id ?? "",
    foretagsnamn: result.foretagsnamn ?? "",
    orgnr: result.orgnr ?? "",
    roll: result.roll ?? null,
    personnummer: result.personnummer ?? null,
    efternamn: result.efternamn ?? null,
    fornamn: result.fornamn ?? null,
    mellannamn: result.mellannamn ?? null,
    adress: result.adress ?? null,
    postnummer: result.postnummer ?? null,
    ort: result.ort ?? null,
  };
}

export function normalizeCompanies(rows: Record<string, unknown>[]): NormalizedCompany[] {
  return rows.map(normalizeCompany);
}

export function normalizePeople(rows: Record<string, unknown>[]): NormalizedPerson[] {
  return rows.map(normalizePerson);
}

// Stats calculation from normalized data
export interface DataStats {
  totalCompanies: number;
  totalPeople: number;
  hasPeopleData: boolean;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  uniquePeople: number;
  boardMembers: number;
  deputies: number;
  uniqueCities: number;
  segments: Record<string, number>;
  lans: Record<string, number>;
}

export function calculateStats(
  companies: NormalizedCompany[],
  people: NormalizedPerson[]
): DataStats {
  const segments: Record<string, number> = {};
  const lans: Record<string, number> = {};

  companies.forEach((c) => {
    const segment = c.segment || "Okänt";
    segments[segment] = (segments[segment] || 0) + 1;

    const lan = c.lan || "Okänt";
    lans[lan] = (lans[lan] || 0) + 1;
  });

  return {
    totalCompanies: companies.length,
    totalPeople: people.length,
    hasPeopleData: people.length > 0,
    companiesWithDomain: companies.filter((c) => c.domain_verified).length,
    companiesWithEmail: companies.filter((c) => c.epost || c.emails_found).length,
    companiesWithPhone: companies.filter((c) => c.phones_found).length,
    uniquePeople: new Set(people.map((p) => p.personnummer).filter(Boolean)).size,
    boardMembers: people.filter(
      (p) => p.roll?.includes("Styrelseledamot")
    ).length,
    deputies: people.filter(
      (p) => p.roll?.includes("Styrelsesuppleant")
    ).length,
    uniqueCities: new Set(people.map((p) => p.ort).filter(Boolean)).size,
    segments,
    lans,
  };
}
