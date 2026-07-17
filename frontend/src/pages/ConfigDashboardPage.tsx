/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import {
  useEffect, useState, useMemo, useCallback,
  useRef, useLayoutEffect,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  RefreshCw, Search, Trash2, ExternalLink,
  CheckSquare, Square, Minus, TrendingUp,
  Briefcase, Clock, Send, Star, X,
  SlidersHorizontal, ArrowUp, ArrowDown, ArrowUpDown,
  BarChart2, BookmarkPlus, ChevronLeft,
  CheckCircle2, XCircle, Inbox,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  title: string;
  company: string;
  locations?: string[];
  location?: string;
  job_type?: string;
  season?: string;
  fields?: string[];
  skills?: string[];
  scraped_at?: string;
  url?: string;
  duration?: { duration?: string; start?: string };
};

type UserJob = {
  id: string;
  job_id: string;
  status: string;
  llm_score?: number;
  cv_to_job?: number;
  job_to_cv?: number;
  created_at: string;
  jobs: Job;
};

type DashboardConfig = {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  last_synced_at?: string;
};

type SortKey = "llm_score" | "company" | "title" | "created_at" | "cv_to_job";
type SortDir = "asc" | "desc";

type Filters = {
  jobType: string;
  minScore: number;
  company: string;
  field: string;
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: "all",      label: "All",       icon: Briefcase,    statuses: null },
  { key: "new",      label: "Incoming",  icon: Inbox,        statuses: ["new"] },
  { key: "saved",    label: "Saved",     icon: Star,         statuses: ["saved"] },
  { key: "queued",   label: "Queue",     icon: Clock,        statuses: ["queued"] },
  { key: "applied",  label: "Applied",   icon: Send,         statuses: ["applied"] },
  { key: "rejected", label: "Rejected",  icon: XCircle,      statuses: ["rejected"] },
];

const STATUS_COLORS: Record<string, string> = {
  new:      "bg-blue-50 text-blue-600",
  saved:    "bg-amber-50 text-amber-600",
  queued:   "bg-purple-50 text-purple-600",
  applied:  "bg-emerald-50 text-emerald-600",
  rejected: "bg-red-50 text-red-500",
};

const ALL_STATUSES = ["new", "saved", "queued", "applied", "rejected"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tok() { return localStorage.getItem("token") || ""; }

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

function ScoreBar({ val }: { val?: number }) {
  if (val == null) return <span className="text-zinc-300 text-xs">—</span>;
  const pct = Math.round(val * 100);
  const color = pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 bg-zinc-100 rounded-full overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-500 tabular-nums w-5">{pct}</span>
    </div>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────

type CtxMenu = { x: number; y: number; jobId: string; userJobId: string } | null;

function ContextMenu({
  menu, onClose, onOpenTab, onStatusChange, onDelete,
}: {
  menu: CtxMenu;
  onClose: () => void;
  onOpenTab: (jobId: string) => void;
  onStatusChange: (userJobId: string, status: string) => void;
  onDelete: (userJobId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  if (!menu) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(menu.y, window.innerHeight - 220),
    left: Math.min(menu.x, window.innerWidth - 180),
    zIndex: 9999,
  };

  return (
    <div ref={ref} style={style} className="bg-white border border-zinc-200 rounded-lg shadow-xl py-1 w-44 text-xs">
      <button
        onClick={() => { onOpenTab(menu.jobId); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-zinc-700 hover:bg-zinc-50 transition-colors"
      >
        <ExternalLink size={12} /> Open in new tab
      </button>
      <div className="border-t border-zinc-100 my-1" />
      <p className="px-3 py-1 text-[10px] text-zinc-400 uppercase tracking-wider">Move to</p>
      {ALL_STATUSES.map((s) => (
        <button
          key={s}
          onClick={() => { onStatusChange(menu.userJobId, s); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 transition-colors capitalize"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[s]?.split(" ")[0]}`} />
          {s}
        </button>
      ))}
      <div className="border-t border-zinc-100 my-1" />
      <button
        onClick={() => { onDelete(menu.userJobId); onClose(); }}
        className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={12} /> Remove
      </button>
    </div>
  );
}

// ─── Filter popover ───────────────────────────────────────────────────────────

function FilterPopover({
  filters, onChange, onClose, jobs,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  jobs: UserJob[];
}) {
  const companies = useMemo(() =>
    [...new Set(jobs.map((j) => j.jobs.company).filter(Boolean))].sort(), [jobs]);
  const fields = useMemo(() => {
    const s = new Set<string>();
    jobs.forEach((j) => j.jobs.fields?.forEach((f) => s.add(f)));
    return [...s].sort();
  }, [jobs]);

  return (
    <div className="absolute top-full right-0 mt-1 bg-white border border-zinc-200 rounded-lg shadow-xl p-4 z-50 w-60 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-800">Filter</span>
        <button onClick={onClose}><X size={12} className="text-zinc-400 hover:text-zinc-700" /></button>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-zinc-400">Job type</label>
        <select
          value={filters.jobType}
          onChange={(e) => onChange({ ...filters, jobType: e.target.value })}
          className="text-xs border border-zinc-200 rounded-md px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
        >
          <option value="">All</option>
          {["full-time", "part-time", "internship", "contract"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-zinc-400">
          Min score — {filters.minScore}%
        </label>
        <input
          type="range" min={0} max={100} step={5}
          value={filters.minScore}
          onChange={(e) => onChange({ ...filters, minScore: +e.target.value })}
          className="accent-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-zinc-400">Company</label>
        <select
          value={filters.company}
          onChange={(e) => onChange({ ...filters, company: e.target.value })}
          className="text-xs border border-zinc-200 rounded-md px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
        >
          <option value="">All</option>
          {companies.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wider text-zinc-400">Field</label>
        <select
          value={filters.field}
          onChange={(e) => onChange({ ...filters, field: e.target.value })}
          className="text-xs border border-zinc-200 rounded-md px-2 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white"
        >
          <option value="">All</option>
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <button
        onClick={() => onChange({ jobType: "", minScore: 0, company: "", field: "" })}
        className="text-[10px] text-zinc-400 hover:text-zinc-700 text-left"
      >
        Clear all filters
      </button>
    </div>
  );
}

// ─── Sort TH ─────────────────────────────────────────────────────────────────

function SortTh({ label, col, sortKey, sortDir, onSort }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400 cursor-pointer select-none hover:text-zinc-700 whitespace-nowrap"
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
          : <ArrowUpDown size={10} className="opacity-30" />}
      </div>
    </th>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

function Analytics({ jobs }: { jobs: UserJob[] }) {
  const total = jobs.length;
  const avgScore = total
    ? Math.round(jobs.reduce((s, j) => s + (j.llm_score ?? 0), 0) / total * 100)
    : 0;
  const byStatus: Record<string, number> = {};
  jobs.forEach((j) => { byStatus[j.status] = (byStatus[j.status] || 0) + 1; });

  const stats = [
    { label: "Total",    value: total,                    icon: <Briefcase size={13} /> },
    { label: "Avg score",value: `${avgScore}%`,           icon: <BarChart2 size={13} /> },
    { label: "Applied",  value: byStatus["applied"] ?? 0, icon: <Send size={13} /> },
    { label: "Saved",    value: byStatus["saved"] ?? 0,   icon: <Star size={13} /> },
    { label: "Queue",    value: byStatus["queued"] ?? 0,  icon: <Clock size={13} /> },
    { label: "Incoming", value: byStatus["new"] ?? 0,     icon: <TrendingUp size={13} /> },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
      {stats.map((s) => (
        <div key={s.label} className="bg-white border border-zinc-100 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
            <span className="text-zinc-300">{s.icon}</span>
          </div>
          <p className="text-lg font-semibold text-zinc-900 tabular-nums leading-none">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SCROLL_KEY = (id: string) => `dashboard-scroll-${id}`;

export default function ConfigDashboardPage() {
  const { configId } = useParams<{ configId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL-driven state ──────────────────────────────────────────────────────
  const tab       = searchParams.get("tab") || "all";
  const search    = searchParams.get("q") || "";
  const sortKey   = (searchParams.get("sort") as SortKey) || "llm_score";
  const sortDir   = (searchParams.get("dir") as SortDir) || "desc";
  const filters: Filters = {
    jobType:  searchParams.get("jobType") || "",
    minScore: Number(searchParams.get("minScore") || 0),
    company:  searchParams.get("company") || "",
    field:    searchParams.get("field") || "",
  };

  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      return next;
    }, { replace: true });
  }

  function setFilters(f: Filters) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      f.jobType  ? next.set("jobType", f.jobType)           : next.delete("jobType");
      f.minScore ? next.set("minScore", String(f.minScore)) : next.delete("minScore");
      f.company  ? next.set("company", f.company)           : next.delete("company");
      f.field    ? next.set("field", f.field)               : next.delete("field");
      return next;
    }, { replace: true });
  }

  // ── Data state ────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [allJobs, setAllJobs] = useState<UserJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLDivElement>(null);

  // ── Load config ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!configId) return;
    fetch(`${API}/dashboard-configs/${configId}`, {
      headers: { Authorization: `Bearer ${tok()}` },
    }).then((r) => r.json()).then(setConfig).catch(console.error);
  }, [configId]);

  // ── Load jobs ─────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    if (!configId) return;
    setLoading(true);
    setSelected(new Set());
    try {
      const batches = await Promise.all(
        [0, 50, 100, 150, 200, 250, 300, 350, 400, 450].map((offset) =>
          fetch(`${API}/dashboard-configs/${configId}/jobs?limit=50&offset=${offset}`, {
            headers: { Authorization: `Bearer ${tok()}` },
          }).then((r) => r.json())
        )
      );
      const seen = new Set<string>();
      const jobs: UserJob[] = batches
        .flatMap((p) => p.jobs || [])
        .filter((j: UserJob) => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });
      setAllJobs(jobs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [configId]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // ── Scroll restoration ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (configId) {
        sessionStorage.setItem(SCROLL_KEY(configId), String(window.scrollY));
      }
    };
  }, [configId]);

  useLayoutEffect(() => {
    if (!loading && configId) {
      const saved = sessionStorage.getItem(SCROLL_KEY(configId));
      if (saved) {
        requestAnimationFrame(() => window.scrollTo({ top: Number(saved), behavior: "instant" }));
        sessionStorage.removeItem(SCROLL_KEY(configId));
      }
    }
  }, [loading, configId]);

  // ── Sync ──────────────────────────────────────────────────────────────────
  async function handleSync() {
    if (!configId) return;
    setSyncing(true);
    try {
      await fetch(`${API}/dashboard-configs/${configId}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}` },
      });
      await loadJobs();
    } finally {
      setSyncing(false);
    }
  }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const currentTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  const displayedJobs = useMemo(() => {
    let jobs = allJobs;

    if (currentTab.statuses) {
      jobs = jobs.filter((j) => currentTab.statuses!.includes(j.status));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter((j) =>
        j.jobs.title?.toLowerCase().includes(q) ||
        j.jobs.company?.toLowerCase().includes(q) ||
        j.jobs.skills?.some((s) => s.toLowerCase().includes(q)) ||
        j.jobs.fields?.some((f) => f.toLowerCase().includes(q))
      );
    }
    if (filters.jobType) jobs = jobs.filter((j) => j.jobs.job_type === filters.jobType);
    if (filters.minScore > 0) jobs = jobs.filter((j) => (j.llm_score ?? 0) * 100 >= filters.minScore);
    if (filters.company) jobs = jobs.filter((j) => j.jobs.company === filters.company);
    if (filters.field) jobs = jobs.filter((j) => j.jobs.fields?.includes(filters.field));

    return [...jobs].sort((a, b) => {
      let av: string | number = 0, bv: string | number = 0;
      if (sortKey === "llm_score")  { av = a.llm_score ?? -1;   bv = b.llm_score ?? -1; }
      if (sortKey === "cv_to_job")  { av = a.cv_to_job ?? -1;   bv = b.cv_to_job ?? -1; }
      if (sortKey === "company")    { av = a.jobs.company ?? ""; bv = b.jobs.company ?? ""; }
      if (sortKey === "title")      { av = a.jobs.title ?? "";   bv = b.jobs.title ?? ""; }
      if (sortKey === "created_at") { av = a.created_at ?? "";   bv = b.created_at ?? ""; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [allJobs, currentTab, search, filters, sortKey, sortDir]);

  // ── Tab counts ────────────────────────────────────────────────────────────
  const tabCounts = useMemo(() => {
    const m: Record<string, number> = { all: allJobs.length };
    allJobs.forEach((j) => { m[j.status] = (m[j.status] || 0) + 1; });
    return m;
  }, [allJobs]);

  // ── Selection ─────────────────────────────────────────────────────────────
  const displayedIds = displayedJobs.map((j) => j.id);
  const allSelected  = displayedIds.length > 0 && displayedIds.every((id) => selected.has(id));
  const someSelected = !allSelected && displayedIds.some((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(displayedIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Status update (single) ────────────────────────────────────────────────
  async function updateStatus(userJobId: string, status: string) {
    setAllJobs((prev) => prev.map((j) => j.id === userJobId ? { ...j, status } : j));
    await fetch(`${API}/user-jobs/${userJobId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(console.error);
  }

  // ── Bulk actions ──────────────────────────────────────────────────────────
  async function handleBulkStatus() {
    if (!bulkStatus || !selected.size) return;
    const ids = [...selected];
    setAllJobs((prev) => prev.map((j) => ids.includes(j.id) ? { ...j, status: bulkStatus } : j));
    await Promise.all(ids.map((id) =>
      fetch(`${API}/user-jobs/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: bulkStatus }),
      })
    ));
    setSelected(new Set());
    setBulkStatus("");
  }

  async function handleBulkDelete(ids: string[] = [...selected]) {
    setAllJobs((prev) => prev.filter((j) => !ids.includes(j.id)));
    setSelected(new Set());
    await Promise.all(ids.map((id) =>
      fetch(`${API}/user-jobs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok()}` },
      })
    ));
  }

  // ── Context menu ──────────────────────────────────────────────────────────
  function handleContextMenu(e: React.MouseEvent, uj: UserJob) {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, jobId: uj.id, userJobId: uj.id });
  }

  function openJobTab(userJobId: string) {
    window.open(`/dashboard/jobs/${userJobId}`, "_blank", "noopener,noreferrer");
  }

  const hasFilters = !!(filters.jobType || filters.minScore || filters.company || filters.field);

  // ── Sort handler ──────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setParam("dir", sortDir === "asc" ? "desc" : "asc");
    } else {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("sort", key);
        next.set("dir", "desc");
        return next;
      }, { replace: true });
    }
  }

  // ── Row navigation ────────────────────────────────────────────────────────
  // Ctrl/Cmd+click or middle-click → new tab (native browser behaviour via <a>)
  // Plain click on row (not on interactive child) → navigate in current tab
  function handleRowClick(e: React.MouseEvent, uj: UserJob) {
    // Let interactive children (select, button, a) handle themselves
    const target = e.target as HTMLElement;
    if (target.closest("select,button,a")) return;

    const href = `/dashboard/jobs/${uj.id}`;

    if (e.ctrlKey || e.metaKey || e.button === 1) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      navigate(href);
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => navigate("/dashboard/configs")}
          className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-zinc-900 truncate">
              {config?.name ?? "Dashboard"}
            </h1>
            {config?.active && (
              <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {allJobs.length} jobs
            {config?.last_synced_at && <> · synced {fmtDate(config.last_synced_at)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAnalytics((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border transition-colors ${
              showAnalytics
                ? "bg-zinc-900 text-white border-zinc-900"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            <BarChart2 size={13} />
            Analytics
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border border-zinc-200 text-zinc-600 hover:border-zinc-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            Sync
          </button>
        </div>
      </div>

      {/* ── Analytics ──────────────────────────────────────────────────── */}
      {showAnalytics && <Analytics jobs={displayedJobs} />}

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-zinc-100 mb-4 overflow-x-auto">
        {TABS.map((t) => {
          const count = t.statuses === null
            ? tabCounts["all"]
            : (tabCounts[t.statuses[0]] ?? 0);
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setParam("tab", t.key === "all" ? "" : t.key); setSelected(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
                active
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-200"
              }`}
            >
              <Icon size={12} />
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums min-w-[18px] text-center ${
                active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search title, company, skills…"
            value={search}
            onChange={(e) => setParam("q", e.target.value)}
            className="w-full pl-8 pr-7 py-2 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400 bg-white placeholder:text-zinc-400"
          />
          {search && (
            <button
              onClick={() => setParam("q", "")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <div className="relative" ref={filterBtnRef}>
          <button
            onClick={() => setShowFilter((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border transition-colors ${
              hasFilters
                ? "border-zinc-900 text-zinc-900 bg-zinc-50"
                : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            <SlidersHorizontal size={13} />
            Filter
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-zinc-900" />}
          </button>
          {showFilter && (
            <FilterPopover
              filters={filters}
              onChange={(f) => { setFilters(f); }}
              onClose={() => setShowFilter(false)}
              jobs={allJobs}
            />
          )}
        </div>

        <span className="text-[10px] text-zinc-400 ml-auto tabular-nums">
          {displayedJobs.length} result{displayedJobs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Bulk bar ───────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-zinc-900 text-white rounded-lg px-4 py-2.5 mb-3 text-xs flex-wrap">
          <span className="font-medium shrink-0">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-md px-2 py-1 text-white text-xs focus:outline-none capitalize"
            >
              <option value="">Move to…</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s} className="text-zinc-900">{s}</option>
              ))}
            </select>
            <button
              onClick={handleBulkStatus}
              disabled={!bulkStatus}
              className="px-3 py-1 rounded-md bg-white text-zinc-900 font-medium disabled:opacity-40 hover:bg-zinc-100 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => handleBulkDelete()}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-red-500/80 hover:bg-red-500 transition-colors"
            >
              <Trash2 size={11} /> Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="p-1 text-white/50 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div ref={tableRef} className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-52">
            <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
          </div>
        ) : displayedJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 text-zinc-400 gap-2">
            <Briefcase size={28} className="text-zinc-200" />
            <p className="text-sm">No jobs match</p>
            <p className="text-xs">
              {hasFilters || search ? "Try clearing filters" : "Sync to pull in jobs"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/70">
                  <th className="w-10 px-3 py-2.5">
                    <button onClick={toggleAll} className="text-zinc-400 hover:text-zinc-700 block">
                      {allSelected
                        ? <CheckSquare size={14} className="text-zinc-900" />
                        : someSelected ? <Minus size={14} /> : <Square size={14} />}
                    </button>
                  </th>
                  <SortTh label="Role"    col="title"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Company" col="company"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Location</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Status</th>
                  <SortTh label="Score"   col="llm_score"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Match"   col="cv_to_job"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <SortTh label="Added"   col="created_at" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {displayedJobs.map((uj) => {
                  const job = uj.jobs;
                  const isSelected = selected.has(uj.id);
                  const loc = job.locations?.slice(0, 1).join(", ") || job.location || "—";

                  return (
                    <tr
                      key={uj.id}
                      onContextMenu={(e) => handleContextMenu(e, uj)}
                      onClick={(e) => handleRowClick(e, uj)}
                      className={`group transition-colors cursor-pointer select-none ${
                        isSelected ? "bg-zinc-50" : "hover:bg-zinc-50/60"
                      }`}
                    >
                      {/* Checkbox — stop propagation so row click doesn't also fire */}
                      <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => toggleOne(uj.id)}
                          className="text-zinc-300 group-hover:text-zinc-400 block"
                        >
                          {isSelected
                            ? <CheckSquare size={14} className="text-zinc-900" />
                            : <Square size={14} />}
                        </button>
                      </td>

                      {/* Role */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <p className="text-xs font-medium text-zinc-900 truncate">{job.title || "—"}</p>
                        {job.job_type && (
                          <p className="text-[10px] text-zinc-400 mt-0.5 capitalize">{job.job_type}</p>
                        )}
                      </td>

                      {/* Company */}
                      <td className="px-3 py-3 max-w-[140px]">
                        <p className="text-xs text-zinc-700 truncate">{job.company || "—"}</p>
                      </td>

                      {/* Location */}
                      <td className="px-3 py-3 max-w-[120px]">
                        <p className="text-xs text-zinc-500 truncate">{loc}</p>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={uj.status}
                          onChange={(e) => updateStatus(uj.id, e.target.value)}
                          className={`text-[10px] font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-300 capitalize ${
                            STATUS_COLORS[uj.status] || "bg-zinc-100 text-zinc-500"
                          }`}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s} className="capitalize">{s}</option>
                          ))}
                        </select>
                      </td>

                      {/* Score */}
                      <td className="px-3 py-3"><ScoreBar val={uj.llm_score} /></td>

                      {/* Match */}
                      <td className="px-3 py-3"><ScoreBar val={uj.cv_to_job} /></td>

                      {/* Added */}
                      <td className="px-3 py-3">
                        <span className="text-[10px] text-zinc-400 whitespace-nowrap">{fmtDate(uj.created_at)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => updateStatus(uj.id, "saved")}
                            title="Save"
                            className="p-1.5 rounded-md text-zinc-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                          >
                            <BookmarkPlus size={13} />
                          </button>
                          <a
                            href={`/dashboard/jobs/${uj.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open in new tab"
                            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {!loading && displayedJobs.length > 0 && (
        <p className="text-[10px] text-zinc-400 mt-3 text-center tabular-nums">
          {displayedJobs.length} of {currentTab.statuses
            ? allJobs.filter((j) => currentTab.statuses!.includes(j.status)).length
            : allJobs.length} jobs
        </p>
      )}

      {/* ── Context menu ───────────────────────────────────────────────── */}
      <ContextMenu
        menu={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onOpenTab={openJobTab}
        onStatusChange={updateStatus}
        onDelete={(id) => handleBulkDelete([id])}
      />
    </div>
  );
}