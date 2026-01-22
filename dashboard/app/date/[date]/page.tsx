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
  X
} from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import Link from "next/link";
import type { NormalizedCompany, NormalizedPerson } from "@/lib/normalize";

interface DataStats {
  totalCompanies: number;
  totalPeople: number;
  hasPeopleData: boolean;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  segments: Record<string, number>;
  lans: Record<string, number>;
}

export default function DateDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const date = params.date as string;
  
  const [companies, setCompanies] = useState<NormalizedCompany[]>([]);
  const [people, setPeople] = useState<NormalizedPerson[]>([]);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [source, setSource] = useState<string>("unknown");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"companies" | "people">("companies");
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
        p.ort
      ].filter(Boolean).join(" ").toLowerCase();
      return text.includes(q);
    });
  }, [people, searchQuery]);

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
              {stats?.totalCompanies} företag, {stats?.totalPeople} personer | {source}
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard icon={Building2} label="Företag" value={stats.totalCompanies} />
          <StatCard icon={Users} label="Personer" value={stats.totalPeople} />
          <StatCard icon={Globe} label="Med domän" value={stats.companiesWithDomain} />
          <StatCard icon={Mail} label="Med e-post" value={stats.companiesWithEmail} />
          <StatCard icon={Phone} label="Med telefon" value={stats.companiesWithPhone} />
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Sök företag eller person..."
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
      <div className="flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab("companies")}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === "companies"
              ? "border-blue-500 text-white"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Building2 className="w-4 h-4" />
          Företag ({filteredCompanies.length})
        </button>
        {people.length > 0 && (
          <button
            onClick={() => setActiveTab("people")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
              activeTab === "people"
                ? "border-blue-500 text-white"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Personer ({filteredPeople.length})
          </button>
        )}
      </div>

      {/* Data Tables */}
      {activeTab === "companies" && (
        <CompaniesTable companies={filteredCompanies} />
      )}
      {activeTab === "people" && people.length > 0 && (
        <PeopleTable people={filteredPeople} />
      )}
    </div>
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
  if (companies.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        Inga företag matchar din sökning
      </div>
    );
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
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {companies.slice(0, 100).map((company, idx) => (
              <tr key={idx} className="hover:bg-zinc-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{company.foretagsnamn}</div>
                  {company.verksamhet && (
                    <div className="text-xs text-zinc-400 truncate max-w-[300px]">
                      {company.verksamhet}
                    </div>
                  )}
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
                <td className="px-4 py-3 text-zinc-400">
                  {company.epost || company.emails_found || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {companies.length > 100 && (
        <div className="px-4 py-3 text-sm text-zinc-400 text-center border-t border-zinc-800">
          Visar 100 av {companies.length} företag
        </div>
      )}
    </div>
  );
}

function PeopleTable({ people }: { people: NormalizedPerson[] }) {
  if (people.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        Inga personer matchar din sökning
      </div>
    );
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
                  {person.roll && (
                    <span className={`px-2 py-1 rounded text-xs ${
                      person.roll.includes("Styrelseledamot")
                        ? "bg-blue-900/50 text-blue-300"
                        : person.roll.includes("Styrelsesuppleant")
                        ? "bg-purple-900/50 text-purple-300"
                        : "bg-zinc-800 text-zinc-300"
                    }`}>
                      {person.roll}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{person.foretagsnamn || "—"}</div>
                  {person.orgnr && (
                    <div className="text-xs text-zinc-400 font-mono">{person.orgnr}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">{person.ort || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {people.length > 100 && (
        <div className="px-4 py-3 text-sm text-zinc-400 text-center border-t border-zinc-800">
          Visar 100 av {people.length} personer
        </div>
      )}
    </div>
  );
}
