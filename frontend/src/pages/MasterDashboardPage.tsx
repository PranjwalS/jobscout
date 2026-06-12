/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, ExternalLink, Mail, Search, Filter, ChevronDown } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  fields: string[];
  skills: string[];
};

type UserJob = {
  id: string;
  job_id: string;
  status: string;
  created_at: string;
  applied_at: string | null;
  cv_to_job_score: number | null;
  llm_score: number | null;
  cover_letter_pdf_url: string | null;
  jobs: Job;
};

const STATUS_COLORS: Record<string, string> = {
  new:       "bg-zinc-100 text-zinc-600",
  saved:     "bg-blue-50 text-blue-600",
  applied:   "bg-amber-50 text-amber-600",
  interview: "bg-green-50 text-green-700",
  rejected:  "bg-red-50 text-red-500",
  ignored:   "bg-zinc-50 text-zinc-400",
};

const ALL_STATUSES = ["new", "saved", "applied", "interview", "rejected", "ignored"];

export default function MasterDashboardPage() {
  const navigate = useNavigate();
  const [userJobs, setUserJobs] = useState<UserJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const token = localStorage.getItem("token");

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/user_jobs/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserJobs(data.user_jobs || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, []);

  const handleStatusChange = async (userJobId: string, newStatus: string) => {
    setUpdatingId(userJobId);
    try {
      await fetch(`${API}/user_jobs/status?user_job_id=${userJobId}&new_status=${newStatus}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      setUserJobs((prev) =>
        prev.map((uj) => uj.id === userJobId ? { ...uj, status: newStatus } : uj)
      );
    } catch {
      // silent
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = userJobs.filter((uj) => {
    const job = uj.jobs;
    const matchSearch = !search ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase()) ||
      job.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || uj.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = userJobs.filter((uj) => uj.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">All Jobs</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Every job you've interacted with, tracked in one place.</p>
      </div>

      {/* Status summary pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border ${statusFilter === "all" ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"}`}
        >
          All ({userJobs.length})
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border capitalize ${statusFilter === s ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"}`}
          >
            {s} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search jobs, companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-4 py-2 text-sm border border-zinc-200 rounded-lg outline-none focus:border-zinc-400 transition-colors bg-white"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-100 p-16 flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
            <Briefcase size={18} className="text-zinc-400" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-1">No jobs yet</h3>
          <p className="text-zinc-400 text-sm max-w-xs mb-4">
            Generate a cover letter from a job posting to start tracking.
          </p>
          <button
            onClick={() => navigate("/dashboard/products/coverletter")}
            className="bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-md hover:bg-zinc-700 transition-colors"
          >
            Generate cover letter
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-100 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_140px_100px_80px_120px_44px] gap-4 px-5 py-3 border-b border-zinc-100 bg-zinc-50">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Job</p>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Company</p>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Location</p>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Score</p>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</p>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider"></p>
          </div>

          {/* Rows */}
          <div className="divide-y divide-zinc-50">
            {filtered.map((uj) => {
              const job = uj.jobs;
              const score = uj.llm_score ?? uj.cv_to_job_score;
              return (
                <div
                  key={uj.id}
                  className="grid grid-cols-[1fr_140px_100px_80px_120px_44px] gap-4 px-5 py-3.5 items-center hover:bg-zinc-50 transition-colors"
                >
                  {/* Title */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 truncate">{job.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">
                      {new Date(uj.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Company */}
                  <p className="text-sm text-zinc-600 truncate">{job.company}</p>

                  {/* Location */}
                  <p className="text-xs text-zinc-400 truncate">{job.location || "—"}</p>

                  {/* Score */}
                  <div>
                    {score != null ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        score >= 70 ? "bg-green-50 text-green-700" :
                        score >= 40 ? "bg-amber-50 text-amber-600" :
                        "bg-red-50 text-red-500"
                      }`}>
                        {score}%
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300">—</span>
                    )}
                  </div>

                  {/* Status dropdown */}
                  <div className="relative">
                    <select
                      value={uj.status}
                      disabled={updatingId === uj.id}
                      onChange={(e) => handleStatusChange(uj.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 outline-none cursor-pointer capitalize appearance-none pr-5 ${STATUS_COLORS[uj.status] || "bg-zinc-100 text-zinc-600"}`}
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-white text-zinc-900 capitalize">{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {uj.cover_letter_pdf_url && (
                      <a
                        href={`${uj.cover_letter_pdf_url}?t=${Date.now()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="View cover letter"
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      >
                        <Mail size={13} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}