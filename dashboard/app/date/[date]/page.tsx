"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { 
  Building2, 
  Users, 
  ArrowLeft, 
  Search, 
  Download, 
  Globe,
  Mail,
  Phone,
  ClipboardCheck,
  X,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import Link from "next/link";
import type { 
  NormalizedCompany, 
  NormalizedPerson,
  NormalizedMail,
  NormalizedAudit 
} from "@/lib/normalize";

interface DataStats {
  totalCompanies: number;
  totalPeople: number;
  totalMails: number;
  totalAudits: number;
  hasPeopleData: boolean;
  hasMailData: boolean;
  hasAuditData: boolean;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  companiesWithPreview: number;
  segments: Record<string, number>;
  lans: Record<string, number>;
  domainStatuses: Record<string, number>;
}

type TabType = "companies" | "people" | "mails" | "audits";

export default function DateDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const date = params.date as string;
  
  const [companies, setCompanies] = useState<NormalizedCompany[]>([]);
  const [people, setPeople] = useState<NormalizedPerson[]>([]);
  const [mails, setMails] = useState<NormalizedMail[]>([]);
  const [audits, setAudits] = useState<NormalizedAudit[]>([]);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [source, setSource] = useState<string>("unknown");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("companies");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [segmentFilter, setSegmentFilter] = useState(searchParams.get("segment") || "");
  const [lanFilter, setLanFilter] = useState(searchParams.get("lan") || "");

  useEffect(() => {
    if (date) {
      fetchData();
    }
  }, [date]);

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/data/${date}`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
        setPeople(data.people || []);
        setMails(data.mails || []);
        setAudits(data.audits || []);
        setStats(data.stats);
        setSource(data.source);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    let result = companies;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => {
        const text = [
          c.foretagsnamn,
          c.orgnr,
          c.mapp,
          c.sate,
          c.epost,
          c.verksamhet,
          c.segment
        ].filter(Boolean).join(" ").toLowerCase();
        return text.includes(q);
      });
    }
    
    if (segmentFilter) {
      result = result.filter((c) => c.segment === segmentFilter);
    }
    
    if (lanFilter) {
      result = result.filter((c) => c.lan === lanFilter);
    }
    
    return result;
  }, [companies, searchQuery, segmentFilter, lanFilter]);

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const q = searchQuery.toLowerCase();
    return people.filter((p) => {
      const text = [
        p.fornamn,
        p.efternamn,
        p.foretagsnamn,
        p.orgnr,
        p.roll,
        p.ort,
        p.mapp
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [people, searchQuery]);

  const filteredMails = useMemo(() => {
    if (!searchQuery.trim()) return mails;
    const q = searchQuery.toLowerCase();
    return mails.filter((m) => {
      const text = [
        m.company,
        m.email,
        m.subject,
        m.folder,
        m.mapp
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [mails, searchQuery]);

  const filteredAudits = useMemo(() => {
    if (!searchQuery.trim()) return audits;
    const q = searchQuery.toLowerCase();
    return audits.filter((a) => {
      const text = [
        a.foretagsnamn,
        a.hemsida,
        a.bransch,
        a.mapp
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [audits, searchQuery]);

  const clearFilters = () => {
    setSearchQuery("");
    setSegmentFilter("");
    setLanFilter("");
  };

  const hasFilters = searchQuery || segmentFilter || lanFilter;

  const formatDate = (dateStr: string) => {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return format(new Date(year, month, day), "d MMMM yyyy", { locale: sv });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Laddar data för {date}...</div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link 
            href="/" 
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{formatDate(date)}</h1>
            <p className="text-zinc-400 text-sm">
              {stats?.totalCompanies} företag, {stats?.totalPeople} personer, {stats?.totalMails} mail | {source}
            </p>
          </div>
        </div>
        <button
          onClick={() => window.location.href = `/api/download/${date}`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Ladda ner ZIP
        </button>
      </header>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard icon={Building2} label="Företag" value={stats.totalCompanies} />
          <StatCard icon={Users} label="Personer" value={stats.totalPeople} />
          <StatCard icon={Mail} label="Mail" value={stats.totalMails} />
          <StatCard icon={ClipboardCheck} label="Audits" value={stats.totalAudits} />
          <StatCard icon={Globe} label="Med domän" value={stats.companiesWithDomain} />
          <StatCard icon={ExternalLink} label="Med preview" value={stats.companiesWithPreview} />
          <StatCard icon={Phone} label="Med telefon" value={stats.companiesWithPhone} />
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Sök företag, person, mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        
        {stats && stats.segments && Object.keys(stats.segments).length > 0 && (
          <select
            value={segmentFilter}
            onChange={(e) => setSegmentFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">Alla segment</option>
            {Object.entries(stats.segments)
              .sort(([, a], [, b]) => b - a)
              .map(([segment, count]) => (
                <option key={segment} value={segment}>
                  {segment} ({count})
                </option>
              ))}
          </select>
        )}
        
        {stats && stats.lans && Object.keys(stats.lans).length > 0 && (
          <select
            value={lanFilter}
            onChange={(e) => setLanFilter(e.target.value)}
            className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer min-w-[180px]"
          >
            <option value="">Alla län</option>
            {Object.entries(stats.lans)
              .sort(([, a], [, b]) => b - a)
              .map(([lan, count]) => (
                <option key={lan} value={lan}>
                  {lan} ({count})
                </option>
              ))}
          </select>
        )}
        
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Rensa filter
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 overflow-x-auto">
        <TabButton 
          active={activeTab === "companies"} 
          onClick={() => setActiveTab("companies")}
          icon={Building2}
          label="Företag"
          count={filteredCompanies.length}
        />
        {people.length > 0 && (
          <TabButton 
            active={activeTab === "people"} 
            onClick={() => setActiveTab("people")}
            icon={Users}
            label="Personer"
            count={filteredPeople.length}
          />
        )}
        {mails.length > 0 && (
          <TabButton 
            active={activeTab === "mails"} 
            onClick={() => setActiveTab("mails")}
            icon={Mail}
            label="Mail"
            count={filteredMails.length}
          />
        )}
        {audits.length > 0 && (
          <TabButton 
            active={activeTab === "audits"} 
            onClick={() => setActiveTab("audits")}
            icon={ClipboardCheck}
            label="Audits"
            count={filteredAudits.length}
          />
        )}
      </div>

      {/* Data Tables */}
      {activeTab === "companies" && <CompaniesTable companies={filteredCompanies} />}
      {activeTab === "people" && <PeopleTable people={filteredPeople} />}
      {activeTab === "mails" && <MailsTable mails={filteredMails} />}
      {activeTab === "audits" && <AuditsTable audits={filteredAudits} />}
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  count 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ElementType; 
  label: string; 
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
        active
          ? "border-blue-500 text-white"
          : "border-transparent text-zinc-400 hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label} ({count})
    </button>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="bg-zinc-900 rounded-lg p-4">
      <div className="flex items-center gap-2 text-zinc-400 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString("sv-SE")}</div>
    </div>
  );
}

function CompaniesTable({ companies }: { companies: NormalizedCompany[] }) {
  const params = useParams();
  const date = params.date as string;
  
  if (companies.length === 0) {
    return <EmptyState message="Inga företag matchar din sökning" />;
  }

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Företag</th>
              <th className="text-left px-4 py-3 font-medium">Org.nr</th>
              <th className="text-left px-4 py-3 font-medium">Segment</th>
              <th className="text-left px-4 py-3 font-medium">Län</th>
              <th className="text-left px-4 py-3 font-medium">Domän</th>
              <th className="text-left px-4 py-3 font-medium">E-post</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {companies.slice(0, 100).map((company, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <Link 
                    href={`/date/${date}/company/${company.mapp}`}
                    className="font-medium text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {company.foretagsnamn}
                  </Link>
                  <div className="text-xs text-zinc-500">{company.mapp}</div>
                </td>
                <td className="px-4 py-3 font-mono text-zinc-400">{company.orgnr}</td>
                <td className="px-4 py-3">
                  {company.segment && (
                    <span className="px-2 py-1 bg-zinc-800 rounded text-xs">
                      {company.segment}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">{company.lan || "—"}</td>
                <td className="px-4 py-3">
                  {company.domain_verified ? (
                    <span className="text-green-400">{company.domain_verified}</span>
                  ) : company.domain_guess ? (
                    <span className="text-zinc-400">{company.domain_guess}</span>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">
                  {company.epost || company.emails_found || "—"}
                </td>
                <td className="px-4 py-3">
                  <DomainStatusBadge status={company.domain_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {companies.length > 100 && (
        <TableFooter shown={100} total={companies.length} type="företag" />
      )}
    </div>
  );
}

function PeopleTable({ people }: { people: NormalizedPerson[] }) {
  if (people.length === 0) {
    return <EmptyState message="Inga personer matchar din sökning" />;
  }

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Namn</th>
              <th className="text-left px-4 py-3 font-medium">Roll</th>
              <th className="text-left px-4 py-3 font-medium">Företag</th>
              <th className="text-left px-4 py-3 font-medium">Ort</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {people.slice(0, 100).map((person, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {[person.fornamn, person.mellannamn, person.efternamn]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={person.roll} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{person.foretagsnamn || "—"}</div>
                  <div className="text-xs text-zinc-500">{person.kungorelse_id}</div>
                </td>
                <td className="px-4 py-3 text-zinc-400">{person.ort || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {people.length > 100 && (
        <TableFooter shown={100} total={people.length} type="personer" />
      )}
    </div>
  );
}

function MailsTable({ mails }: { mails: NormalizedMail[] }) {
  if (mails.length === 0) {
    return <EmptyState message="Inga mail matchar din sökning" />;
  }

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Företag</th>
              <th className="text-left px-4 py-3 font-medium">E-post</th>
              <th className="text-left px-4 py-3 font-medium">Ämne</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {mails.slice(0, 100).map((mail, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{mail.company}</div>
                  <div className="text-xs text-zinc-500">{mail.folder}</div>
                </td>
                <td className="px-4 py-3 text-zinc-400">{mail.email}</td>
                <td className="px-4 py-3 max-w-[300px] truncate">{mail.subject}</td>
                <td className="px-4 py-3">
                  <DomainStatusBadge status={mail.domain_status} />
                </td>
                <td className="px-4 py-3">
                  {mail.site_preview_url ? (
                    <a 
                      href={mail.site_preview_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Visa
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mails.length > 100 && (
        <TableFooter shown={100} total={mails.length} type="mail" />
      )}
    </div>
  );
}

function AuditsTable({ audits }: { audits: NormalizedAudit[] }) {
  if (audits.length === 0) {
    return <EmptyState message="Inga audits matchar din sökning" />;
  }

  return (
    <div className="bg-zinc-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-800">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Företag</th>
              <th className="text-left px-4 py-3 font-medium">Hemsida</th>
              <th className="text-left px-4 py-3 font-medium">Datum</th>
              <th className="text-left px-4 py-3 font-medium">Helhet</th>
              <th className="text-left px-4 py-3 font-medium">Design</th>
              <th className="text-left px-4 py-3 font-medium">SEO</th>
              <th className="text-left px-4 py-3 font-medium">Mobil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {audits.slice(0, 100).map((audit, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{audit.foretagsnamn}</div>
                  <div className="text-xs text-zinc-500">{audit.mapp}</div>
                </td>
                <td className="px-4 py-3">
                  {audit.hemsida ? (
                    <a 
                      href={audit.hemsida} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {new URL(audit.hemsida).hostname}
                    </a>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">{audit.audit_datum || "—"}</td>
                <td className="px-4 py-3"><ScoreBadge score={audit.helhet} /></td>
                <td className="px-4 py-3"><ScoreBadge score={audit.design} /></td>
                <td className="px-4 py-3"><ScoreBadge score={audit.seo} /></td>
                <td className="px-4 py-3"><ScoreBadge score={audit.mobil} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {audits.length > 100 && (
        <TableFooter shown={100} total={audits.length} type="audits" />
      )}
    </div>
  );
}

function DomainStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-600">—</span>;
  
  const colors: Record<string, string> = {
    verified: "bg-green-900/50 text-green-300",
    unknown: "bg-zinc-800 text-zinc-400",
    wrong_company: "bg-yellow-900/50 text-yellow-300",
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs ${colors[status] || colors.unknown}`}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-zinc-600">—</span>;
  
  const color = role.includes("Styrelseledamot")
    ? "bg-blue-900/50 text-blue-300"
    : role.includes("Styrelsesuppleant")
    ? "bg-purple-900/50 text-purple-300"
    : "bg-zinc-800 text-zinc-300";
    
  return <span className={`px-2 py-1 rounded text-xs ${color}`}>{role}</span>;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-zinc-600">—</span>;
  }
  
  const color = score >= 7 ? "text-green-400" : 
                score >= 4 ? "text-yellow-400" : "text-red-400";
  
  return <span className={`font-bold ${color}`}>{score.toFixed(1)}</span>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-zinc-400">
      {message}
    </div>
  );
}

function TableFooter({ shown, total, type }: { shown: number; total: number; type: string }) {
  return (
    <div className="px-4 py-3 text-sm text-zinc-400 text-center border-t border-zinc-800">
      Visar {shown} av {total} {type}
    </div>
  );
}
