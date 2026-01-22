"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  Building2, 
  Users, 
  ArrowLeft, 
  Globe,
  Mail,
  Calendar
} from "lucide-react";
import Link from "next/link";
import type { NormalizedCompany, NormalizedPerson } from "@/lib/normalize";

interface CompanyWithDate extends NormalizedCompany {
  sourceDate: string;
  hasMail: boolean;
  hasAudit: boolean;
  hasPreview: boolean;
  worthySite: boolean;
  hasEmail: boolean;
  hasDomain: boolean;
}

interface PersonWithDate extends NormalizedPerson {
  sourceDate: string;
}

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const segment = searchParams.get("segment") || "";
  const lan = searchParams.get("lan") || "";
  const hasMail = parseBooleanParam(searchParams.get("hasMail"));
  const hasAudit = parseBooleanParam(searchParams.get("hasAudit"));
  const hasPreview = parseBooleanParam(searchParams.get("hasPreview"));
  const worthySite = parseBooleanParam(searchParams.get("worthy"));
  const hasEmail = parseBooleanParam(searchParams.get("hasEmail"));
  const hasDomain = parseBooleanParam(searchParams.get("hasDomain"));
  
  const [companies, setCompanies] = useState<CompanyWithDate[]>([]);
  const [people, setPeople] = useState<PersonWithDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [totalPeople, setTotalPeople] = useState(0);
  const [activeTab, setActiveTab] = useState<"companies" | "people">("companies");

  useEffect(() => {
    fetchResults();
  }, [query, segment, lan, hasMail, hasAudit, hasPreview, worthySite, hasEmail, hasDomain]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (segment) params.set("segment", segment);
      if (lan) params.set("lan", lan);
      if (hasMail) params.set("hasMail", "1");
      if (hasAudit) params.set("hasAudit", "1");
      if (hasPreview) params.set("hasPreview", "1");
      if (worthySite) params.set("worthy", "1");
      if (hasEmail) params.set("hasEmail", "1");
      if (hasDomain) params.set("hasDomain", "1");
      
      const response = await fetch(`/api/search?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
        setPeople(data.people || []);
        setTotalCompanies(data.totalCompanies || 0);
        setTotalPeople(data.totalPeople || 0);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    const parts: string[] = [];
    if (segment) parts.push(`Segment: ${segment}`);
    if (lan) parts.push(`Län: ${lan}`);
    if (hasMail) parts.push("Har mail");
    if (hasAudit) parts.push("Har audit");
    if (hasPreview) parts.push("Har preview");
    if (worthySite) parts.push("Ska få sajt");
    if (hasEmail) parts.push("Har e-post");
    if (hasDomain) parts.push("Har domän");
    if (query) parts.push(`Sök: "${query}"`);
    return parts.length > 0 ? parts.join(" • ") : "Sökresultat";
  };

  const formatDate = (dateStr: string) => {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return new Date(year, month, day).toLocaleDateString("sv-SE");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Söker...</div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      {/* Header */}
      <header>
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Tillbaka
        </Link>
        
        <h1 className="text-2xl font-bold">{getTitle()}</h1>
        <p className="text-zinc-400 mt-1">
          {totalCompanies} företag{totalPeople > 0 ? `, ${totalPeople} personer` : ""} över alla datum
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Företag" value={totalCompanies} />
        <StatCard icon={Users} label="Personer" value={totalPeople} />
        <StatCard 
          icon={Globe} 
          label="Har domän" 
          value={companies.filter(c => c.hasDomain).length} 
        />
        <StatCard 
          icon={Mail} 
          label="Har e-post" 
          value={companies.filter(c => c.hasEmail).length} 
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        <TabButton 
          active={activeTab === "companies"} 
          onClick={() => setActiveTab("companies")}
          icon={Building2}
          label="Företag"
          count={companies.length}
        />
        {people.length > 0 && (
          <TabButton 
            active={activeTab === "people"} 
            onClick={() => setActiveTab("people")}
            icon={Users}
            label="Personer"
            count={people.length}
          />
        )}
      </div>

      {/* Results */}
      {activeTab === "companies" && (
        <CompaniesTable companies={companies} formatDate={formatDate} />
      )}
      {activeTab === "people" && (
        <PeopleTable people={people} formatDate={formatDate} />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-zinc-400">Laddar...</div></div>}>
      <SearchResultsContent />
    </Suspense>
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
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
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

function CompaniesTable({ 
  companies, 
  formatDate 
}: { 
  companies: CompanyWithDate[]; 
  formatDate: (d: string) => string;
}) {
  if (companies.length === 0) {
    return <div className="text-center py-12 text-zinc-400">Inga företag hittades</div>;
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
              <th className="text-left px-4 py-3 font-medium">E-post</th>
              <th className="text-left px-4 py-3 font-medium">Datum</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {companies.map((company, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <Link 
                    href={`/date/${company.sourceDate}/company/${company.mapp}`}
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
                <td className="px-4 py-3 text-zinc-400 max-w-[200px] truncate">
                  {company.epost || company.emails_found || "—"}
                </td>
                <td className="px-4 py-3">
                  <Link 
                    href={`/date/${company.sourceDate}`}
                    className="flex items-center gap-1 text-zinc-400 hover:text-white text-xs"
                  >
                    <Calendar className="w-3 h-3" />
                    {formatDate(company.sourceDate)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {company.hasMail && <StatusBadge label="Mail" />}
                    {company.hasAudit && <StatusBadge label="Audit" />}
                    {company.hasPreview && <StatusBadge label="Preview" />}
                    {company.worthySite && <StatusBadge label="Sajt" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {companies.length >= 200 && (
        <div className="px-4 py-3 text-sm text-zinc-400 text-center border-t border-zinc-800">
          Visar max 200 resultat
        </div>
      )}
    </div>
  );
}

function PeopleTable({ 
  people, 
  formatDate 
}: { 
  people: PersonWithDate[]; 
  formatDate: (d: string) => string;
}) {
  if (people.length === 0) {
    return <div className="text-center py-12 text-zinc-400">Inga personer hittades</div>;
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
              <th className="text-left px-4 py-3 font-medium">Datum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {people.map((person, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3 font-medium">
                  {[person.fornamn, person.mellannamn, person.efternamn]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={person.roll} />
                </td>
                <td className="px-4 py-3">
                  <Link 
                    href={`/date/${person.sourceDate}/company/${person.mapp || person.kungorelse_id}`}
                    className="text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    {person.foretagsnamn || "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-400">{person.ort || "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-zinc-400 text-xs">
                    <Calendar className="w-3 h-3" />
                    {formatDate(person.sourceDate)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300">
      {label}
    </span>
  );
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
