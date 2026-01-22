"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Users, 
  Globe,
  Mail,
  Phone,
  Download,
  Calendar,
  Search,
  ChevronRight,
  FolderArchive,
  Trash2,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface DateFolder {
  date: string;
  formatted: string;
}

interface TotalStats {
  totalCompanies: number;
  totalPeople: number;
  totalMails: number;
  totalAudits: number;
  companiesWithDomain: number;
  companiesWithEmail: number;
  companiesWithPhone: number;
  totalDates: number;
  segments: Record<string, number>;
  lans: Record<string, number>;
}

export default function HomePage() {
  const [dates, setDates] = useState<DateFolder[]>([]);
  const [stats, setStats] = useState<TotalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchDates();
    fetchTotals();
  }, []);

  const fetchDates = async () => {
    try {
      const response = await fetch("/api/data/dates");
      if (response.ok) {
        const data = await response.json();
        setDates(data.dates);
      }
    } catch (error) {
      console.error("Error fetching dates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotals = async () => {
    try {
      const response = await fetch("/api/data/totals");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching totals:", error);
    }
  };

  const handleDateClick = (date: string) => {
    router.push(`/date/${date}`);
  };

  const handleDownloadAll = async () => {
    for (const dateFolder of dates) {
      const link = document.createElement("a");
      link.href = `/api/download/${dateFolder.date}`;
      link.download = `${dateFolder.date}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const handleDeleteAll = async () => {
    if (!adminSecret) {
      alert("Ange admin-lösenord (UPLOAD_SECRET)");
      return;
    }
    
    setDeleting(true);
    try {
      const response = await fetch("/api/admin/clear-data", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${adminSecret}`,
        },
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        alert(`Raderade ${result.deletedFolders} datamängder`);
        setDeleteConfirm(false);
        setAdminSecret("");
        fetchDates();
        fetchTotals();
      } else {
        alert(`Fel: ${result.error || "Kunde inte radera"}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Fel vid radering");
    } finally {
      setDeleting(false);
    }
  };

  // Get latest date for search navigation
  const latestDate = dates.length > 0 ? dates[0].date : null;

  const formatDate = (dateStr: string) => {
    const year = parseInt(dateStr.slice(0, 4));
    const month = parseInt(dateStr.slice(4, 6)) - 1;
    const day = parseInt(dateStr.slice(6, 8));
    return format(new Date(year, month, day), "d MMMM yyyy", { locale: sv });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Laddar...</div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Jocke Data</h1>
          <p className="text-zinc-400 mt-1">Sök och utforska företagsdata från kungörelser</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <FolderArchive className="w-4 h-4" />
            Ladda ner alla ZIP
          </button>
        </div>
      </header>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
        <input
          type="text"
          placeholder="Sök företag, org.nr, person..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && latestDate) {
              router.push(`/date/${latestDate}?search=${encodeURIComponent(searchQuery)}`);
            }
          }}
          className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard icon={Building2} label="Företag" value={stats.totalCompanies} />
          <StatCard icon={Users} label="Personer" value={stats.totalPeople} />
          <StatCard icon={Globe} label="Med domän" value={stats.companiesWithDomain} />
          <StatCard icon={Mail} label="Med e-post" value={stats.companiesWithEmail} />
          <StatCard icon={Phone} label="Med telefon" value={stats.companiesWithPhone} />
          <StatCard icon={Calendar} label="Datamängder" value={dates.length} />
        </div>
      )}

      {/* Segments */}
      {stats && stats.segments && Object.keys(stats.segments).length > 0 && (
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Segment</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.segments)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 15)
              .map(([segment, count]) => (
                <button
                  key={segment}
                  onClick={() => latestDate && router.push(`/date/${latestDate}?segment=${encodeURIComponent(segment)}`)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm transition-colors"
                >
                  {segment} <span className="text-zinc-400">({count})</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* Län distribution */}
      {stats && stats.lans && Object.keys(stats.lans).length > 0 && (
        <section className="bg-zinc-900 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Län</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.lans)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 15)
              .map(([lan, count]) => (
                <button
                  key={lan}
                  onClick={() => latestDate && router.push(`/date/${latestDate}?lan=${encodeURIComponent(lan)}`)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm transition-colors"
                >
                  {lan} <span className="text-zinc-400">({count})</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* Date Folders */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Tillgängliga datamängder</h2>
        <div className="grid gap-3">
          {dates.map((dateFolder) => (
            <div
              key={dateFolder.date}
              className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer"
              onClick={() => handleDateClick(dateFolder.date)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <div className="font-medium">{formatDate(dateFolder.date)}</div>
                  <div className="text-sm text-zinc-400">{dateFolder.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/api/download/${dateFolder.date}`;
                  }}
                  className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Ladda ner ZIP"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDateClick(dateFolder.date);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Visa data
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {dates.length === 0 && (
        <div className="text-center py-12 text-zinc-400">
          Ingen data hittades. Se till att det finns datamängder i data_bundles/
        </div>
      )}

      {/* Admin Section */}
      <section className="border-t border-zinc-800 pt-8">
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showAdmin ? "Dölj admin" : "Visa admin-verktyg"}
        </button>
        
        {showAdmin && (
          <div className="mt-4 p-6 bg-zinc-900 rounded-lg border border-zinc-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Admin-verktyg
            </h3>
            
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                <div className="flex-1">
                  <label className="block text-sm text-zinc-400 mb-1">
                    Admin-lösenord (UPLOAD_SECRET)
                  </label>
                  <input
                    type="password"
                    value={adminSecret}
                    onChange={(e) => setAdminSecret(e.target.value)}
                    placeholder="Ange lösenord..."
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-500"
                  />
                </div>
                
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    disabled={!adminSecret}
                    className="flex items-center gap-2 px-4 py-2 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Radera all data
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeleteAll}
                      disabled={deleting}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deleting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {deleting ? "Raderar..." : "Bekräfta radering"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                    >
                      Avbryt
                    </button>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-zinc-500">
                Raderar {dates.length} datamängder från servern. Du kan sedan ladda upp nya via upload-skriptet.
              </p>
            </div>
          </div>
        )}
      </section>
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
