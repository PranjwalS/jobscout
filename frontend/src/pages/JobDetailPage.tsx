/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, ExternalLink, MapPin, Calendar,
  Building2, RefreshCw, FileText, Mail, Send, Star, XCircle,
  Trash2, Clock, CheckCircle2, AlertCircle,
  Bookmark, MessageSquare,
} from "lucide-react";
import { CvEditorModal, ClEditorModal } from "./JobEditors";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  locations?: string[];
  description?: string;
  source?: string;
  season?: string;
  fields?: string[];
  skills?: string[];
  requirements?: Record<string, unknown>;
  salary?: Record<string, unknown>;
  duration?: { duration?: string; start?: string; end?: string };
  job_type?: string;
  url?: string;
  scraped_at?: string;
};

type UserJob = {
  id: string;
  user_id: string;
  dashboard_config_id?: string;
  job_id: string;
  cv_json?: Record<string, unknown>;
  cv_pdf_url?: string;
  cover_letter_text?: string;
  cover_letter_html?: string;
  cover_letter_pdf_url?: string;
  cv_to_job_score?: number;
  job_to_cv_score?: number;
  match_score?: number;
  cv_to_job_detail?: Record<string, unknown>;
  job_to_cv_detail?: Record<string, unknown>;
  llm_score?: number;
  llm_rationale?: string;
  status: string;
  notes?: string;
  next_event?: string;
  applied_at?: string;
  created_at: string;
  updated_at?: string;
};

type JobDetailResponse = {
  job: Job;
  user_job: UserJob;
};

const VALID_STATUSES = ["new", "saved", "applied", "rejected", "ignored", "interview"] as const;

const STATUS_CONFIG: Record<string, { color: string; icon: typeof Star }> = {
  new:       { color: "bg-blue-50 text-blue-600",       icon: AlertCircle },
  saved:     { color: "bg-amber-50 text-amber-600",     icon: Star },
  queued:    { color: "bg-purple-50 text-purple-600",   icon: Clock },
  applied:   { color: "bg-emerald-50 text-emerald-600", icon: Send },
  interview: { color: "bg-violet-50 text-violet-600",   icon: MessageSquare },
  rejected:  { color: "bg-red-50 text-red-500",         icon: XCircle },
  ignored:   { color: "bg-zinc-100 text-zinc-400",      icon: XCircle },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tok() { return localStorage.getItem("token") || ""; }

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function ScoreRing({ val, label }: { val?: number; label: string }) {
  const pct = val == null ? null : Math.round(val <= 1 ? val * 100 : val);
  const color = pct == null ? "#d4d4d8" : pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = pct == null ? circumference : circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#f4f4f5" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-zinc-900 tabular-nums">
            {pct == null ? "—" : `${pct}`}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-zinc-400 uppercase tracking-wider text-center leading-tight">{label}</span>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] px-2 py-1 rounded-md bg-zinc-50 text-zinc-600 border border-zinc-100">
      {children}
    </span>
  );
}

function ToolButton({
  icon: Icon, label, onClick, disabled, danger, loading, active,
}: {
  icon: typeof Star; label: string; onClick: () => void;
  disabled?: boolean; danger?: boolean; loading?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : active
            ? "bg-zinc-900 text-white"
            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      <Icon size={14} className={loading ? "animate-spin" : ""} />
      {label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { userJobId } = useParams<{ userJobId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<JobDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-action loading flags — keeps tool buttons independently responsive
  const [regenCv, setRegenCv] = useState(false);
  const [regenCl, setRegenCl] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const [notesDraft, setNotesDraft] = useState("");

  const [cvEditorOpen, setCvEditorOpen] = useState(false);
  const [clEditorOpen, setClEditorOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userJobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/user-jobs/${userJobId}`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) throw new Error(res.status === 404 ? "Job not found" : "Failed to load job");
      const json: JobDetailResponse = await res.json();
      setData(json);
      setNotesDraft(json.user_job.notes || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [userJobId]);

  useEffect(() => { load(); }, [load]);

  async function patchUserJob(updates: Record<string, unknown>) {
    if (!data) return;
    // Optimistic
    setData((prev) => prev ? { ...prev, user_job: { ...prev.user_job, ...updates } } : prev);
    try {
      const res = await fetch(`${API}/user-jobs/${userJobId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Update failed");
    } catch (e) {
      console.error(e);
      load(); // revert by reloading on failure
    }
  }

  async function handleStatusChange(status: string) {
    await patchUserJob({ status, ...(status === "applied" ? { applied_at: new Date().toISOString() } : {}) });
  }

  async function handleRegenCv() {
    if (!userJobId) return;
    setRegenCv(true);
    try {
      const res = await fetch(`${API}/custom_cv/generate?user_job_id=${userJobId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) throw new Error("CV generation failed");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setRegenCv(false);
    }
  }

  async function handleRegenCl() {
    if (!userJobId) return;
    setRegenCl(true);
    try {
      const res = await fetch(`${API}/custom_cl/generate?user_job_id=${userJobId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (!res.ok) throw new Error("Cover letter generation failed");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setRegenCl(false);
    }
  }

  async function handleDelete() {
    if (!userJobId || !data) return;
    if (!window.confirm(`Remove "${data.job.title}" from your tracker?`)) return;
    try {
      await fetch(`${API}/user-jobs/${userJobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok()}` },
      });
      navigate(-1);
    } catch (e) {
      console.error(e);
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    await patchUserJob({ notes: notesDraft });
    setSavingNotes(false);
  }

  // ── Render states ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3 text-zinc-400">
        <AlertCircle size={28} className="text-zinc-200" />
        <p className="text-sm text-zinc-500">{error || "Could not load this job"}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-zinc-500 hover:text-zinc-900 underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const { job, user_job } = data;
  const loc = job.locations?.length ? job.locations.join(", ") : job.location || "Remote / Unspecified";
  const statusCfg = STATUS_CONFIG[user_job.status] || STATUS_CONFIG.new;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── Back ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors mb-4"
      >
        <ChevronLeft size={14} /> Back to dashboard
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">

        {/* ── Left: stacked job content ─────────────────────────────── */}
        <div className="flex flex-col gap-5 min-w-0">

          {/* Header card */}
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${statusCfg.color}`}>
                    <StatusIcon size={10} />
                    <span className="capitalize">{user_job.status}</span>
                  </span>
                  {job.job_type && <Pill>{job.job_type}</Pill>}
                  {job.season && <Pill>{job.season}</Pill>}
                </div>
                <h1 className="text-xl font-semibold text-zinc-900 leading-tight">{job.title}</h1>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500 flex-wrap">
                  <span className="flex items-center gap-1"><Building2 size={12} /> {job.company}</span>
                  <span className="flex items-center gap-1"><MapPin size={12} /> {loc}</span>
                  {job.duration?.duration && (
                    <span className="flex items-center gap-1"><Calendar size={12} /> {job.duration.duration}</span>
                  )}
                </div>
              </div>

              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border border-zinc-200 text-zinc-600 hover:border-zinc-400 transition-colors shrink-0"
                >
                  <ExternalLink size={13} /> View posting
                </a>
              )}
            </div>

            {(job.fields?.length || job.skills?.length) ? (
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-zinc-50">
                {job.fields?.length ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider w-14 shrink-0">Fields</span>
                    {job.fields.map((f) => <Pill key={f}>{f}</Pill>)}
                  </div>
                ) : null}
                {job.skills?.length ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-zinc-400 uppercase tracking-wider w-14 shrink-0">Skills</span>
                    {job.skills.map((s) => <Pill key={s}>{s}</Pill>)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Scores card */}
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-4">Match breakdown</h2>
            <div className="flex items-center gap-6 flex-wrap">
              <ScoreRing val={user_job.llm_score} label="LLM Score" />
              <ScoreRing val={user_job.cv_to_job_score} label="CV → Job" />
              <ScoreRing val={user_job.job_to_cv_score} label="Job → CV" />
              <ScoreRing val={user_job.match_score} label="Overall" />
            </div>
            {user_job.llm_rationale && (
              <p className="text-xs text-zinc-500 leading-relaxed mt-4 pt-4 border-t border-zinc-50">
                {user_job.llm_rationale}
              </p>
            )}
          </div>

          {/* Description card */}
          {job.description && (
            <div className="bg-white border border-zinc-100 rounded-xl p-5">
              <h2 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-3">Description</h2>
              <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {/* Generated content card */}
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-3">Application materials</h2>
            <div className="flex flex-col gap-3">

              {/* CV row */}
              <div className="flex items-center justify-between gap-3 py-2 border-b border-zinc-50">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={14} className="text-zinc-400 shrink-0" />
                  <span className="text-xs text-zinc-700">Custom CV</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    user_job.cv_json ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                  }`}>
                    {user_job.cv_json ? "Generated" : "Not generated"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {user_job.cv_json && (
                    <button
                      onClick={() => setCvEditorOpen(true)}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-zinc-200 text-zinc-600 hover:border-zinc-400 transition-colors"
                    >
                      Edit CV
                    </button>
                  )}
                  {user_job.cv_pdf_url && (
                    <a href={user_job.cv_pdf_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-700">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>

              {/* Cover letter row */}
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail size={14} className="text-zinc-400 shrink-0" />
                  <span className="text-xs text-zinc-700">Cover letter</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    user_job.cover_letter_text ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                  }`}>
                    {user_job.cover_letter_text ? "Generated" : "Not generated"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {user_job.cover_letter_html && (
                    <button
                      onClick={() => setClEditorOpen(true)}
                      className="text-[11px] px-2.5 py-1 rounded-md border border-zinc-200 text-zinc-600 hover:border-zinc-400 transition-colors"
                    >
                      Edit CL
                    </button>
                  )}
                  {user_job.cover_letter_pdf_url && (
                    <a href={user_job.cover_letter_pdf_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-700">
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>



          {/* Notes card */}
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider mb-3">Notes</h2>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Interview prep, referral contact, follow-up reminders…"
              className="w-full text-xs border border-zinc-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none placeholder:text-zinc-400"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-zinc-400 tabular-nums">{notesDraft.length}/1000</span>
              <button
                onClick={saveNotes}
                disabled={savingNotes || notesDraft === (user_job.notes || "")}
                className="text-xs px-3 py-1.5 rounded-md bg-zinc-900 text-white disabled:opacity-30 hover:bg-zinc-800 transition-colors"
              >
                {savingNotes ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: tools panel ────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-6 self-start">

          {/* Status switcher */}
          <div className="bg-white border border-zinc-100 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">Status</p>
            <div className="flex flex-col gap-0.5">
              {VALID_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                const active = user_job.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                      active ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    <Icon size={13} />
                    {s}
                    {active && <CheckCircle2 size={12} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tools */}
          <div className="bg-white border border-zinc-100 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">Tools</p>
            <div className="flex flex-col gap-0.5">
              <ToolButton
                icon={RefreshCw}
                label={user_job.cv_json ? "Regenerate CV" : "Generate CV"}
                onClick={handleRegenCv}
                loading={regenCv}
              />
              <ToolButton
                icon={RefreshCw}
                label={user_job.cover_letter_text ? "Regenerate cover letter" : "Generate cover letter"}
                onClick={handleRegenCl}
                loading={regenCl}
              />
              <ToolButton
                icon={Bookmark}
                label={user_job.status === "saved" ? "Saved" : "Save for later"}
                onClick={() => handleStatusChange("saved")}
                active={user_job.status === "saved"}
              />
            </div>
          </div>

          {/* Meta */}
          <div className="bg-white border border-zinc-100 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Details</p>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Added</span>
              <span className="text-zinc-700">{fmtDate(user_job.created_at)}</span>
            </div>
            {user_job.applied_at && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Applied</span>
                <span className="text-zinc-700">{fmtDate(user_job.applied_at)}</span>
              </div>
            )}
            {user_job.next_event && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Next event</span>
                <span className="text-zinc-700">{fmtDateTime(user_job.next_event)}</span>
              </div>
            )}
            {job.scraped_at && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Scraped</span>
                <span className="text-zinc-700">{fmtDate(job.scraped_at)}</span>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="bg-white border border-zinc-100 rounded-xl p-3">
            <ToolButton icon={Trash2} label="Remove from tracker" onClick={handleDelete} danger />
          </div>
        </div>
      </div>

      {cvEditorOpen && user_job.cv_json && (
        <CvEditorModal
          userJobId={userJobId!}
          initialCvJson={user_job.cv_json as any}
          onClose={() => setCvEditorOpen(false)}
          onSaved={(newCvJson, pdfUrl) => {
            setData((prev) =>
              prev ? {
                ...prev,
                user_job: { ...prev.user_job, cv_json: newCvJson as any, cv_pdf_url: pdfUrl }
              } : prev
            );
          }}
        />
      )}

      {clEditorOpen && user_job.cover_letter_html && (
        <ClEditorModal
          userJobId={userJobId!}
          initialHtml={user_job.cover_letter_html}
          onClose={() => setClEditorOpen(false)}
          onSaved={(pdfUrl) => {
            setData((prev) =>
              prev ? {
                ...prev,
                user_job: { ...prev.user_job, cover_letter_pdf_url: pdfUrl }
              } : prev
            );
          }}
        />
      )}
    </div>
  );
}