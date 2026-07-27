import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SalaryConfig {
  type: "hourly" | "weekly" | "monthly" | "yearly";
  min?: number;
  max?: number;
}

interface DateRange {
  start?: string;
  end?: string;
}

interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  job_types: string[];
  include_fields: string[];
  exclude_fields: string[];
  include_skills: string[];
  exclude_skills: string[];
  location_mode: "preference" | "hard";
  include_locations: string[];
  exclude_locations: string[];
  include_companies: string[];
  exclude_companies: string[];
  company_mode: "preference" | "hard";
  salary?: SalaryConfig;
  seasons: string[];
  work_term_duration?: string;
  date_range?: DateRange;
  active: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
      {children}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-xl p-5 flex flex-col gap-4">
      <p className="text-xs font-semibold text-zinc-400 border-b border-zinc-100 pb-2.5 m-0">
        {title}
      </p>
      {children}
    </div>
  );
}

function ChipToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors capitalize ${
        active
          ? "bg-blue-50 border-blue-200 text-blue-600"
          : "bg-zinc-50 border-zinc-100 text-zinc-500 hover:border-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: "preference" | "hard";
  onChange: (v: "preference" | "hard") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-zinc-100 overflow-hidden">
      {(["preference", "hard"] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs font-medium border-r border-zinc-100 last:border-0 transition-colors ${
            value === opt
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-500 hover:bg-zinc-50"
          }`}
        >
          {opt === "preference" ? "Preference" : "Hard filter"}
        </button>
      ))}
    </div>
  );
}

function TagInput({
  label,
  values,
  suggestions,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  suggestions?: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [showSug, setShowSug] = useState(false);

  const filtered =
    suggestions?.filter(
      (s) => s.toLowerCase().includes(input.toLowerCase()) && !values.includes(s)
    ) ?? [];

  const add = (val: string) => {
    const v = val.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
    setShowSug(false);
  };

  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="relative flex flex-wrap gap-1.5 p-2 min-h-[42px] bg-zinc-50 border border-zinc-200 rounded-lg">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-md text-xs font-medium"
          >
            {v}
            <button
              onClick={() => remove(v)}
              className="text-blue-400 hover:text-blue-700 leading-none"
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSug(true); }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && input.trim()) {
              e.preventDefault();
              add(input);
            }
            if (e.key === "Backspace" && !input && values.length) {
              remove(values[values.length - 1]);
            }
          }}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-xs text-zinc-700 placeholder:text-zinc-300"
        />
        {showSug && filtered.length > 0 && (
          <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-zinc-200 rounded-lg z-20 max-h-48 overflow-y-auto shadow-sm">
            {filtered.slice(0, 20).map((s) => (
              <button
                key={s}
                onMouseDown={() => add(s)}
                className="block w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Toast({
  message,
  type,
  onDone,
}: {
  message: string;
  type: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-6 right-6 px-4 py-2.5 rounded-lg text-xs font-medium z-50 shadow-sm border ${
        type === "success"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-red-50 text-red-700 border-red-200"
      }`}
    >
      {message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const JOB_TYPES = ["fulltime", "parttime", "internship", "contract"];
const SEASONS = ["winter", "spring", "summer", "fall"];
const SALARY_TYPES = ["hourly", "weekly", "monthly", "yearly"] as const;
const DURATIONS = ["4 months", "8 months", "12 months", "16 months"];

export default function EditDashboard() {
  const { configId } = useParams<{ configId: string }>();
  const navigate = useNavigate();

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [form, setForm] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<string[]>([]);
  const [allLocations, setAllLocations] = useState<string[]>([]);

  useEffect(() => {
    if (!configId) return;

    let cancelled = false;

    Promise.all([
      apiFetch<DashboardConfig>(`/dashboard-configs/${configId}`),
      apiFetch<Record<string, Record<string, string[]>>>("/meta/skills"),
      apiFetch<string[]>("/meta/fields"),
      apiFetch<{ name: string; cities: string[] }[]>("/meta/locations"),
    ])
      .then(([cfg, skillsMap, fields, locs]) => {
        if (cancelled) return;
        setConfig(cfg);
        setForm(cfg);

        const flat: string[] = [];
        Object.values(skillsMap).forEach((cats) =>
          Object.values(cats).forEach((arr) => flat.push(...arr))
        );
        setAllSkills([...new Set(flat)].sort());
        setAllFields(fields.sort());
        setAllLocations(locs.flatMap((g) => [g.name, ...g.cities]));
      })
      .catch((e) => {
        if (!cancelled) setToast({ msg: e.message, type: "error" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [configId]);

  const patch = <K extends keyof DashboardConfig>(key: K, value: DashboardConfig[K]) =>
    setForm((f) => f ? { ...f, [key]: value } : f);

  const save = useCallback(async () => {
    if (!configId || !form) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description,
        job_types: form.job_types,
        include_fields: form.include_fields,
        exclude_fields: form.exclude_fields,
        include_skills: form.include_skills,
        exclude_skills: form.exclude_skills,
        location: {
          mode: form.location_mode,
          includes: form.include_locations,
          excludes: form.exclude_locations,
        },
        include_companies: form.include_companies,
        exclude_companies: form.exclude_companies,
        company_mode: form.company_mode,
        salary: form.salary ?? null,
        seasons: form.seasons,
        work_term_duration: form.work_term_duration,
        date_range: form.date_range ?? null,
        active: form.active,
      };
      const updated = await apiFetch<DashboardConfig>(`/dashboard-configs/${configId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setConfig(updated);
      setForm(updated);
      setToast({ msg: "Changes saved", type: "success" });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Save failed", type: "error" });
    } finally {
      setSaving(false);
    }
  }, [configId, form]);

  const activate = async () => {
    if (!configId) return;
    try {
      const updated = await apiFetch<DashboardConfig>(`/dashboard-configs/${configId}/launch`, {
        method: "POST",
      });
      setConfig(updated);
      setForm(updated);
      setToast({ msg: "Dashboard activated", type: "success" });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Activate failed", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (!form || !config) {
    return <div className="p-6 text-sm text-red-500">Config not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 pb-16 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-zinc-400 hover:text-zinc-600 mb-1.5 flex items-center gap-1"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-zinc-900 m-0">
            {form.name || "Untitled dashboard"}
          </h1>
          {config.active && (
            <span className="mt-1.5 inline-block text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md px-2 py-0.5">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!form.active && (
            <button
              onClick={activate}
              className="px-3 py-2 text-xs font-semibold border border-zinc-200 rounded-md text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Activate
            </button>
          )}
          <button
            onClick={() => form && setForm(config)}
            className="px-3 py-2 text-xs font-semibold border border-zinc-200 rounded-md text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-md hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Basic info */}
      <SectionCard title="Basic info">
        <div className="flex flex-col gap-2">
          <Label>Name</Label>
          <input
            value={form.name}
            onChange={(e) => patch("name", e.target.value)}
            placeholder="e.g. Summer 2025 SWE"
            className="w-full text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-800 outline-none focus:border-zinc-400"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Description</Label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => patch("description", e.target.value)}
            placeholder="Optional notes"
            rows={2}
            className="w-full text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-800 outline-none focus:border-zinc-400 resize-none"
          />
        </div>
      </SectionCard>

      {/* Job type & season */}
      <SectionCard title="Job type and season">
        <div className="flex flex-col gap-2">
          <Label>Job types</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map((jt) => (
              <ChipToggle
                key={jt}
                label={jt}
                active={(form.job_types ?? []).includes(jt)}
                onClick={() => {
                  const cur = form.job_types ?? [];
                  patch("job_types", cur.includes(jt) ? cur.filter((x) => x !== jt) : [...cur, jt]);
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Seasons</Label>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <ChipToggle
                key={s}
                label={s}
                active={(form.seasons ?? []).includes(s)}
                onClick={() => {
                  const cur = form.seasons ?? [];
                  patch("seasons", cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
                }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Work term duration</Label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <ChipToggle
                key={d}
                label={d}
                active={form.work_term_duration === d}
                onClick={() => patch("work_term_duration", form.work_term_duration === d ? undefined : d)}
              />
            ))}
          </div>
        </div>
      </SectionCard>

      {/* Date range */}
      <SectionCard title="Date range">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Start</Label>
            <input
              type="date"
              value={form.date_range?.start ?? ""}
              onChange={(e) =>
                patch("date_range", { ...form.date_range, start: e.target.value || undefined })
              }
              className="text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-800 outline-none focus:border-zinc-400"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>End</Label>
            <input
              type="date"
              value={form.date_range?.end ?? ""}
              onChange={(e) =>
                patch("date_range", { ...form.date_range, end: e.target.value || undefined })
              }
              className="text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-800 outline-none focus:border-zinc-400"
            />
          </div>
        </div>
      </SectionCard>

      {/* Fields */}
      <SectionCard title="Fields">
        <TagInput
          label="Include fields"
          values={form.include_fields ?? []}
          suggestions={allFields}
          onChange={(v) => patch("include_fields", v)}
          placeholder="Add a field…"
        />
        <TagInput
          label="Exclude fields"
          values={form.exclude_fields ?? []}
          suggestions={allFields}
          onChange={(v) => patch("exclude_fields", v)}
          placeholder="Add a field to exclude…"
        />
      </SectionCard>

      {/* Skills */}
      <SectionCard title="Skills">
        <TagInput
          label="Include skills"
          values={form.include_skills ?? []}
          suggestions={allSkills}
          onChange={(v) => patch("include_skills", v)}
          placeholder="Add a skill…"
        />
        <TagInput
          label="Exclude skills"
          values={form.exclude_skills ?? []}
          suggestions={allSkills}
          onChange={(v) => patch("exclude_skills", v)}
          placeholder="Add a skill to exclude…"
        />
      </SectionCard>

      {/* Location */}
      <SectionCard title="Location">
        <div className="flex flex-col gap-2">
          <Label>Filter mode</Label>
          <ModeToggle
            value={form.location_mode ?? "preference"}
            onChange={(v) => patch("location_mode", v)}
          />
          <p className="text-[11px] text-zinc-400 m-0">
            {form.location_mode === "hard"
              ? "Only show jobs in included locations."
              : "Prefer included locations, but don't hide others."}
          </p>
        </div>
        <TagInput
          label="Include locations"
          values={form.include_locations ?? []}
          suggestions={allLocations}
          onChange={(v) => patch("include_locations", v)}
          placeholder="City or country…"
        />
        <TagInput
          label="Exclude locations"
          values={form.exclude_locations ?? []}
          suggestions={allLocations}
          onChange={(v) => patch("exclude_locations", v)}
          placeholder="City or country to exclude…"
        />
      </SectionCard>

      {/* Companies */}
      <SectionCard title="Companies">
        <div className="flex flex-col gap-2">
          <Label>Filter mode</Label>
          <ModeToggle
            value={form.company_mode ?? "preference"}
            onChange={(v) => patch("company_mode", v)}
          />
        </div>
        <TagInput
          label="Include companies"
          values={form.include_companies ?? []}
          onChange={(v) => patch("include_companies", v)}
          placeholder="Company name…"
        />
        <TagInput
          label="Exclude companies"
          values={form.exclude_companies ?? []}
          onChange={(v) => patch("exclude_companies", v)}
          placeholder="Company name to exclude…"
        />
      </SectionCard>

      {/* Salary */}
      <SectionCard title="Salary">
        <div className="flex flex-col gap-2">
          <Label>Pay period</Label>
          <div className="flex flex-wrap gap-2">
            {SALARY_TYPES.map((t) => (
              <ChipToggle
                key={t}
                label={t}
                active={form.salary?.type === t}
                onClick={() =>
                  patch("salary", form.salary?.type === t
                    ? undefined
                    : { type: t, min: form.salary?.min, max: form.salary?.max }
                  )
                }
              />
            ))}
          </div>
        </div>
        {form.salary && (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Min</Label>
              <input
                type="number"
                value={form.salary.min ?? ""}
                onChange={(e) =>
                  patch("salary", {
                    ...form.salary!,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="0"
                className="text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-800 outline-none focus:border-zinc-400"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Max</Label>
              <input
                type="number"
                value={form.salary.max ?? ""}
                onChange={(e) =>
                  patch("salary", {
                    ...form.salary!,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="No limit"
                className="text-sm px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-800 outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Bottom save */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={() => setForm(config)}
          className="px-3 py-2 text-xs font-semibold border border-zinc-200 rounded-md text-zinc-500 hover:bg-zinc-50 transition-colors"
        >
          Discard changes
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-md hover:bg-zinc-700 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {toast && (
        <Toast message={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  );
}