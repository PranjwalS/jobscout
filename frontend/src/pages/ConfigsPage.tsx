import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus, RefreshCw, CheckCircle2, Clock } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type DashboardConfig = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  last_synced_at?: string;
  job_types?: string[];
  seasons?: string[];
  include_fields?: string[];
};

function fmt(iso?: string) {
  if (!iso) return "Never synced";
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function ConfigsPage() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<DashboardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/dashboard-configs`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then(setConfigs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSync(e: React.MouseEvent, configId: string) {
    e.stopPropagation();
    setSyncing(configId);
    try {
      await fetch(`${API}/dashboard-configs/${configId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      // refresh last_synced_at
      const res = await fetch(`${API}/dashboard-configs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setConfigs(await res.json());
    } finally {
      setSyncing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Dashboards</h1>
          <p className="text-xs text-zinc-400 mt-0.5">{configs.length} configured · pick one to open</p>
        </div>
        <button
          onClick={() => navigate("/dashboard/new")}
          className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-zinc-700 transition-colors"
        >
          <Plus size={13} /> New dashboard
        </button>
      </div>

      {configs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 border border-dashed border-zinc-200 rounded-xl gap-3 text-zinc-400">
          <Briefcase size={28} className="text-zinc-200" />
          <p className="text-sm">No dashboards yet</p>
          <button
            onClick={() => navigate("/dashboard/new")}
            className="text-xs text-zinc-900 underline underline-offset-2"
          >
            Create your first dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {configs.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/dashboard/configs/${c.id}`)}
              className="group bg-white border border-zinc-100 rounded-xl p-4 cursor-pointer hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{c.name}</p>
                    {c.active && (
                      <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{c.description}</p>
                  )}
                </div>
                <button
                  onClick={(e) => handleSync(e, c.id)}
                  disabled={syncing === c.id}
                  className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  title="Sync jobs"
                >
                  <RefreshCw size={12} className={syncing === c.id ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.job_types?.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 bg-zinc-100 text-zinc-500 rounded-full capitalize">{t}</span>
                ))}
                {c.include_fields?.slice(0, 2).map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full">{f}</span>
                ))}
              </div>

              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <Clock size={10} />
                {fmt(c.last_synced_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}