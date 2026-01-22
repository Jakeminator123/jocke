"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { 
  Building2, 
  Users, 
  ArrowLeft, 
  Globe,
  Mail,
  MapPin,
  FileText,
  ClipboardCheck,
  ExternalLink,
  Briefcase,
  Hash
} from "lucide-react";
import Link from "next/link";
import type { 
  NormalizedCompany, 
  NormalizedPerson,
  NormalizedMail,
  NormalizedAudit 
} from "@/lib/normalize";

interface CompanyData {
  company: NormalizedCompany | null;
  people: NormalizedPerson[];
  mails: NormalizedMail[];
  audits: NormalizedAudit[];
}

export default function CompanyDetailPage() {
  const params = useParams();
  const date = params.date as string;
  const mapp = params.mapp as string;
  
  const [data, setData] = useState<CompanyData>({
    company: null,
    people: [],
    mails: [],
    audits: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (date && mapp) {
      fetchCompanyData();
    }
  }, [date, mapp]);

  const fetchCompanyData = async () => {
    try {
      const response = await fetch(`/api/data/${date}`);
      if (response.ok) {
        const allData = await response.json();
        
        // Find the specific company
        const company = allData.companies?.find(
          (c: NormalizedCompany) => c.mapp === mapp
        ) || null;
        
        // Find all people for this company
        const people = (allData.people || []).filter(
          (p: NormalizedPerson) => p.kungorelse_id === mapp
        );
        
        // Find all mails for this company
        const mails = (allData.mails || []).filter(
          (m: NormalizedMail) => m.folder === mapp
        );
        
        // Find all audits for this company
        const audits = (allData.audits || []).filter(
          (a: NormalizedAudit) => a.mapp === mapp
        );
        
        setData({ company, people, mails, audits });
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Laddar företagsdata...</div>
      </div>
    );
  }

  if (!data.company) {
    return (
      <div className="py-8">
        <Link 
          href={`/date/${date}`}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka
        </Link>
        <div className="text-center py-12 text-zinc-400">
          Företaget hittades inte
        </div>
      </div>
    );
  }

  const { company, people, mails, audits } = data;

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <header>
        <Link 
          href={`/date/${date}`}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka till {date}
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{company.foretagsnamn}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-zinc-400">
              <span className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                {company.orgnr}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                {company.mapp}
              </span>
              {company.segment && (
                <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs">
                  {company.segment}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            {company.domain_verified && (
              <a
                href={`https://${company.domain_verified}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
              >
                <Globe className="w-4 h-4" />
                Besök hemsida
              </a>
            )}
            {company.kalla_url && (
              <a
                href={company.kalla_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Bolagsverket
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Company Info Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-zinc-400" />
            Grunduppgifter
          </h2>
          <dl className="space-y-3">
            <InfoRow label="Typ" value={company.typ} />
            <InfoRow label="Bildat" value={company.bildat} />
            <InfoRow label="Registreringsdatum" value={company.registreringsdatum} />
            <InfoRow label="Publiceringsdatum" value={company.publiceringsdatum} />
            <InfoRow label="Räkenskapsår" value={company.rakenskapsar} />
            <InfoRow label="Aktiekapital" value={company.aktiekapital} />
            <InfoRow label="Antal aktier" value={company.antal_aktier?.toString()} />
          </dl>
        </section>

        {/* Location */}
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-zinc-400" />
            Plats & Kontakt
          </h2>
          <dl className="space-y-3">
            <InfoRow label="Län" value={company.lan} />
            <InfoRow label="Säte" value={company.sate} />
            <InfoRow label="Postadress" value={company.postadress} />
            <InfoRow label="E-post" value={company.epost} />
            <InfoRow label="Domän (verifierad)" value={company.domain_verified} />
            <InfoRow label="Domän (gissad)" value={company.domain_guess} />
            <InfoRow label="Domänstatus" value={company.domain_status} />
            <InfoRow label="Hittade e-poster" value={company.emails_found} />
            <InfoRow label="Hittade telefon" value={company.phones_found} />
          </dl>
        </section>
      </div>

      {/* Verksamhet */}
      {company.verksamhet && (
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-zinc-400" />
            Verksamhet
          </h2>
          <p className="text-zinc-300 whitespace-pre-wrap">{company.verksamhet}</p>
        </section>
      )}

      {/* Firmateckning */}
      {company.firmateckning && (
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Firmateckning</h2>
          <p className="text-zinc-300 whitespace-pre-wrap">{company.firmateckning}</p>
        </section>
      )}

      {/* People */}
      <section className="bg-zinc-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-zinc-400" />
          Personer ({people.length})
        </h2>
        
        {people.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {people.map((person, idx) => (
              <div key={idx} className="bg-zinc-800 rounded-lg p-4">
                <div className="font-medium">
                  {[person.fornamn, person.mellannamn, person.efternamn]
                    .filter(Boolean)
                    .join(" ")}
                </div>
                <div className="text-sm text-zinc-400 mt-1">
                  <RoleBadge role={person.roll} />
                </div>
                {person.ort && (
                  <div className="text-sm text-zinc-500 mt-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {person.ort}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">Ingen persondata tillgänglig</p>
        )}
        
        {/* Show raw board data if no normalized people */}
        {people.length === 0 && (company.styrelseledamoter || company.styrelsesuppleanter) && (
          <div className="mt-4 space-y-4">
            {company.styrelseledamoter && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Styrelseledamöter (rådata)</h3>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-800 p-3 rounded">
                  {company.styrelseledamoter}
                </p>
              </div>
            )}
            {company.styrelsesuppleanter && (
              <div>
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Styrelsesuppleanter (rådata)</h3>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-800 p-3 rounded">
                  {company.styrelsesuppleanter}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Mails */}
      <section className="bg-zinc-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-zinc-400" />
          Genererade mail ({mails.length})
        </h2>
        
        {mails.length > 0 ? (
          <div className="space-y-4">
            {mails.map((mail, idx) => (
              <div key={idx} className="bg-zinc-800 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                  <div>
                    <div className="font-medium">{mail.subject}</div>
                    <div className="text-sm text-zinc-400">Till: {mail.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DomainStatusBadge status={mail.domain_status} />
                    {mail.site_preview_url && (
                      <a
                        href={mail.site_preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Preview
                      </a>
                    )}
                  </div>
                </div>
                {mail.mail_content && (
                  <details className="mt-2">
                    <summary className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-300">
                      Visa mailinnehåll
                    </summary>
                    <pre className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap bg-zinc-900 p-3 rounded max-h-64 overflow-y-auto">
                      {mail.mail_content}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">Inga genererade mail</p>
        )}
      </section>

      {/* Audits */}
      <section className="bg-zinc-900 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-zinc-400" />
          Webbplats-audits ({audits.length})
        </h2>
        
        {audits.length > 0 ? (
          <div className="space-y-4">
            {audits.map((audit, idx) => (
              <div key={idx} className="bg-zinc-800 rounded-lg p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
                  <div>
                    {audit.hemsida && (
                      <a
                        href={audit.hemsida}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        <Globe className="w-4 h-4" />
                        {audit.hemsida}
                      </a>
                    )}
                    <div className="text-sm text-zinc-400 mt-1">
                      {audit.audit_datum} | {audit.bransch || "Okänd bransch"}
                    </div>
                  </div>
                </div>
                
                {/* Scores */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                  <ScoreCard label="Helhet" score={audit.helhet} />
                  <ScoreCard label="Design" score={audit.design} />
                  <ScoreCard label="Innehåll" score={audit.innehall} />
                  <ScoreCard label="Användbarhet" score={audit.anvandbarhet} />
                  <ScoreCard label="Mobil" score={audit.mobil} />
                  <ScoreCard label="SEO" score={audit.seo} />
                </div>
                
                {/* Feedback */}
                {audit.styrkor && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-green-400 mb-1">Styrkor</h4>
                    <p className="text-sm text-zinc-300">{audit.styrkor}</p>
                  </div>
                )}
                {audit.svagheter && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-red-400 mb-1">Svagheter</h4>
                    <p className="text-sm text-zinc-300">{audit.svagheter}</p>
                  </div>
                )}
                {audit.rekommendationer && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-400 mb-1">Rekommendationer</h4>
                    <p className="text-sm text-zinc-300">{audit.rekommendationer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500">Inga audits gjorda</p>
        )}
      </section>

      {/* Evaluation status */}
      {(company.ska_fa_sajt || company.preview_url) && (
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Bedömning</h2>
          <dl className="space-y-3">
            <InfoRow label="Ska få sajt" value={company.ska_fa_sajt} />
            <InfoRow label="Konfidens" value={company.konfidens} />
            {company.preview_url && (
              <div className="flex items-center justify-between py-2">
                <dt className="text-zinc-400">Preview URL</dt>
                <dd>
                  <a
                    href={company.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Öppna preview
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2 border-b border-zinc-800 last:border-0">
      <dt className="text-zinc-400">{label}</dt>
      <dd className="text-zinc-100 text-right max-w-[60%]">{value}</dd>
    </div>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  
  const color = role.includes("Styrelseledamot")
    ? "bg-blue-900/50 text-blue-300"
    : role.includes("Styrelsesuppleant")
    ? "bg-purple-900/50 text-purple-300"
    : role.includes("VD")
    ? "bg-green-900/50 text-green-300"
    : "bg-zinc-700 text-zinc-300";
    
  return <span className={`inline-block px-2 py-0.5 rounded text-xs ${color}`}>{role}</span>;
}

function DomainStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  
  const colors: Record<string, string> = {
    verified: "bg-green-900/50 text-green-300",
    unknown: "bg-zinc-700 text-zinc-400",
    wrong_company: "bg-yellow-900/50 text-yellow-300",
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${colors[status] || colors.unknown}`}>
      {status}
    </span>
  );
}

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  const color = score === null ? "text-zinc-600" :
                score >= 7 ? "text-green-400" : 
                score >= 4 ? "text-yellow-400" : "text-red-400";
  
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>
        {score !== null ? score.toFixed(1) : "—"}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
