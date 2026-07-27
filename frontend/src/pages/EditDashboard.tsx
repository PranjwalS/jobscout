/* eslint-disable @typescript-eslint/no-unused-vars */
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

interface LocationConfig {
  mode: "preference" | "hard";
  includes: string[];
  excludes: string[];
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

// ─── API helpers ──────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("access_token");
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

// ─── Small reusable UI bits ───────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </span>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "0.5px solid var(--border)",
        borderRadius: 12,
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-secondary)",
          borderBottom: "0.5px solid var(--border)",
          paddingBottom: 10,
        }}
      >
        {title}
      </p>
      {children}
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
      (s) =>
        s.toLowerCase().includes(input.toLowerCase()) && !values.includes(s)
    ) ?? [];

  const add = (val: string) => {
    const v = val.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput("");
    setShowSug(false);
  };

  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Label>{label}</Label>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: "8px 10px",
          background: "var(--surface-2)",
          border: "0.5px solid var(--border-strong)",
          borderRadius: "var(--radius)",
          minHeight: 42,
          position: "relative",
        }}
      >
        {values.map((v) => (
          <span
            key={v}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "var(--bg-accent)",
              color: "var(--text-accent)",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 500,
              padding: "3px 8px",
            }}
          >
            {v}
            <button
              onClick={() => remove(v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-accent)",
                padding: 0,
                lineHeight: 1,
                fontSize: 13,
                opacity: 0.7,
              }}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowSug(true);
          }}
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
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 13,
            flex: 1,
            minWidth: 80,
          }}
        />
        {showSug && filtered.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--surface-2)",
              border: "0.5px solid var(--border-strong)",
              borderRadius: "var(--radius)",
              zIndex: 20,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {filtered.slice(0, 20).map((s) => (
              <button
                key={s}
                onMouseDown={() => add(s)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: "8px 12px",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "var(--surface-1)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background =
                    "none")
                }
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

function TogglePill({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--surface-0)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: "5px 14px",
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            background:
              value === o.value ? "var(--surface-2)" : "transparent",
            color:
              value === o.value
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            borderRight: "0.5px solid var(--border)",
          }}
        >
          {o.label}
        </button>
      ))}
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
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        background: type === "success" ? "var(--bg-success)" : "var(--bg-danger)",
        color: type === "success" ? "var(--text-success)" : "var(--text-danger)",
        border: `0.5px solid ${type === "success" ? "var(--border-success)" : "var(--border-danger)"}`,
        borderRadius: 10,
        padding: "10px 18px",
        fontSize: 13,
        fontWeight: 500,
        zIndex: 999,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      {message}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DashboardConfigEditPage() {
  const { configId } = useParams<{ configId: string }>();
  const navigate = useNavigate();

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);

  // meta lists
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [allFields, setAllFields] = useState<string[]>([]);
  const [locationGroups, setLocationGroups] = useState<
    { name: string; cities: string[] }[]
  >([]);

  // local form state (mirrors config)
  const [form, setForm] = useState<Partial<DashboardConfig>>({});

  // ── Load config + meta ──
  useEffect(() => {
    if (!configId) return;
    setLoading(true);
    Promise.all([
      apiFetch<DashboardConfig>(`/dashboard-configs/${configId}`),
      apiFetch<Record<string, Record<string, string[]>>>("/meta/skills"),
      apiFetch<string[]>("/meta/fields"),
      apiFetch<{ name: string; cities: string[] }[]>("/meta/locations"),
    ])
      .then(([cfg, skillsMap, fields, locs]) => {
        setConfig(cfg);
        setForm(cfg);
        // flatten skills map → string[]
        const flat: string[] = [];
        Object.values(skillsMap).forEach((cats) =>
          Object.values(cats).forEach((arr) => flat.push(...arr))
        );
        setAllSkills([...new Set(flat)].sort());
        setAllFields(fields.sort());
        setLocationGroups(locs);
      })
      .catch((e) => setToast({ msg: e.message, type: "error" }))
      .finally(() => setLoading(false));
  }, [configId]);

  const allLocationStrings = locationGroups.flatMap((g) => [
    g.name,
    ...g.cities,
  ]);

  // ── Field helpers ──
  const set = <K extends keyof DashboardConfig>(
    key: K,
    value: DashboardConfig[K]
  ) => setForm((f) => ({ ...f, [key]: value }));

  // ── Save ──
  const save = useCallback(async () => {
    if (!configId || !form) return;
    setSaving(true);
    try {
      // Build patch payload matching DashboardConfigPatch shape
      const patch: Record<string, unknown> = {
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

      const updated = await apiFetch<DashboardConfig>(
        `/dashboard-configs/${configId}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setConfig(updated);
      setForm(updated);
      setToast({ msg: "Changes saved", type: "success" });
    } catch (e: unknown) {
      setToast({
        msg: e instanceof Error ? e.message : "Save failed",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [configId, form]);

  // ── Launch / deactivate ──
  const launch = async () => {
    if (!configId) return;
    try {
      await apiFetch(`/dashboard-configs/${configId}/launch`, {
        method: "POST",
      });
      setForm((f) => ({ ...f, active: true }));
      setToast({ msg: "Dashboard activated", type: "success" });
    } catch (e: unknown) {
      setToast({
        msg: e instanceof Error ? e.message : "Launch failed",
        type: "error",
      });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "50vh",
          color: "var(--text-secondary)",
          fontSize: 14,
        }}
      >
        Loading config…
      </div>
    );
  }

  if (!config || !form) {
    return (
      <div style={{ padding: "2rem", color: "var(--text-danger)" }}>
        Config not found.
      </div>
    );
  }

  const JOB_TYPES = ["fulltime", "parttime", "internship", "contract"];
  const SEASONS = ["winter", "spring", "summer", "fall"];
  const SALARY_TYPES = ["hourly", "weekly", "monthly", "yearly"];
  const DURATIONS = ["4 months", "8 months", "12 months", "16 months"];

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← Back
          </button>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            {form.name || "Untitled dashboard"}
          </h1>
          {config.active && (
            <span
              style={{
                marginTop: 6,
                display: "inline-block",
                fontSize: 11,
                fontWeight: 500,
                background: "var(--bg-success)",
                color: "var(--text-success)",
                border: "0.5px solid var(--border-success)",
                borderRadius: 6,
                padding: "2px 8px",
              }}
            >
              Active
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {!form.active && (
            <button
              onClick={launch}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                background: "var(--bg-accent)",
                color: "var(--text-accent)",
                border: "0.5px solid var(--border-accent)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
              }}
            >
              Activate
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 500,
              background: saving ? "var(--surface-1)" : "var(--fill-primary)",
              color: saving ? "var(--text-muted)" : "var(--on-primary)",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* ── Basic info ── */}
      <SectionCard title="Basic info">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Name</Label>
          <input
            value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Summer 2025 SWE"
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Description</Label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Optional notes about this dashboard"
            rows={2}
            style={{
              width: "100%",
              resize: "vertical",
              fontFamily: "var(--font-sans)",
            }}
          />
        </div>
      </SectionCard>

      {/* ── Job type + Season ── */}
      <SectionCard title="Job type and season">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Job types</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {JOB_TYPES.map((jt) => {
              const active = (form.job_types ?? []).includes(jt);
              return (
                <button
                  key={jt}
                  onClick={() => {
                    const cur = form.job_types ?? [];
                    set(
                      "job_types",
                      active ? cur.filter((x) => x !== jt) : [...cur, jt]
                    );
                  }}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: "var(--radius)",
                    border: active
                      ? "0.5px solid var(--border-accent)"
                      : "0.5px solid var(--border)",
                    background: active
                      ? "var(--bg-accent)"
                      : "var(--surface-0)",
                    color: active
                      ? "var(--text-accent)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {jt}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Seasons</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SEASONS.map((s) => {
              const active = (form.seasons ?? []).includes(s);
              return (
                <button
                  key={s}
                  onClick={() => {
                    const cur = form.seasons ?? [];
                    set(
                      "seasons",
                      active ? cur.filter((x) => x !== s) : [...cur, s]
                    );
                  }}
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: "var(--radius)",
                    border: active
                      ? "0.5px solid var(--border-accent)"
                      : "0.5px solid var(--border)",
                    background: active
                      ? "var(--bg-accent)"
                      : "var(--surface-0)",
                    color: active
                      ? "var(--text-accent)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Work term duration</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DURATIONS.map((d) => {
              const active = form.work_term_duration === d;
              return (
                <button
                  key={d}
                  onClick={() =>
                    set("work_term_duration", active ? undefined : d)
                  }
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: "var(--radius)",
                    border: active
                      ? "0.5px solid var(--border-accent)"
                      : "0.5px solid var(--border)",
                    background: active
                      ? "var(--bg-accent)"
                      : "var(--surface-0)",
                    color: active
                      ? "var(--text-accent)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* ── Date range ── */}
      <SectionCard title="Date range">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Label>Start</Label>
            <input
              type="date"
              value={form.date_range?.start ?? ""}
              onChange={(e) =>
                set("date_range", {
                  ...(form.date_range ?? {}),
                  start: e.target.value || undefined,
                })
              }
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Label>End</Label>
            <input
              type="date"
              value={form.date_range?.end ?? ""}
              onChange={(e) =>
                set("date_range", {
                  ...(form.date_range ?? {}),
                  end: e.target.value || undefined,
                })
              }
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Fields ── */}
      <SectionCard title="Fields">
        <TagInput
          label="Include fields"
          values={form.include_fields ?? []}
          suggestions={allFields}
          onChange={(v) => set("include_fields", v)}
          placeholder="Add a field…"
        />
        <TagInput
          label="Exclude fields"
          values={form.exclude_fields ?? []}
          suggestions={allFields}
          onChange={(v) => set("exclude_fields", v)}
          placeholder="Add a field to exclude…"
        />
      </SectionCard>

      {/* ── Skills ── */}
      <SectionCard title="Skills">
        <TagInput
          label="Include skills"
          values={form.include_skills ?? []}
          suggestions={allSkills}
          onChange={(v) => set("include_skills", v)}
          placeholder="Add a skill…"
        />
        <TagInput
          label="Exclude skills"
          values={form.exclude_skills ?? []}
          suggestions={allSkills}
          onChange={(v) => set("exclude_skills", v)}
          placeholder="Add a skill to exclude…"
        />
      </SectionCard>

      {/* ── Location ── */}
      <SectionCard title="Location">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Filter mode</Label>
          <TogglePill
            options={[
              { label: "Preference", value: "preference" },
              { label: "Hard filter", value: "hard" },
            ]}
            value={form.location_mode ?? "preference"}
            onChange={(v) =>
              set("location_mode", v as "preference" | "hard")
            }
          />
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            {form.location_mode === "hard"
              ? "Only show jobs in included locations."
              : "Prefer included locations, but don't hide others."}
          </p>
        </div>
        <TagInput
          label="Include locations"
          values={form.include_locations ?? []}
          suggestions={allLocationStrings}
          onChange={(v) => set("include_locations", v)}
          placeholder="City or country…"
        />
        <TagInput
          label="Exclude locations"
          values={form.exclude_locations ?? []}
          suggestions={allLocationStrings}
          onChange={(v) => set("exclude_locations", v)}
          placeholder="City or country to exclude…"
        />
      </SectionCard>

      {/* ── Companies ── */}
      <SectionCard title="Companies">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Filter mode</Label>
          <TogglePill
            options={[
              { label: "Preference", value: "preference" },
              { label: "Hard filter", value: "hard" },
            ]}
            value={form.company_mode ?? "preference"}
            onChange={(v) => set("company_mode", v as "preference" | "hard")}
          />
        </div>
        <TagInput
          label="Include companies"
          values={form.include_companies ?? []}
          onChange={(v) => set("include_companies", v)}
          placeholder="Company name…"
        />
        <TagInput
          label="Exclude companies"
          values={form.exclude_companies ?? []}
          onChange={(v) => set("exclude_companies", v)}
          placeholder="Company name to exclude…"
        />
      </SectionCard>

      {/* ── Salary ── */}
      <SectionCard title="Salary">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Label>Pay period</Label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SALARY_TYPES.map((t) => {
              const active = form.salary?.type === t;
              return (
                <button
                  key={t}
                  onClick={() =>
                    set("salary", {
                      type: t as SalaryConfig["type"],
                      min: form.salary?.min,
                      max: form.salary?.max,
                    })
                  }
                  style={{
                    padding: "5px 14px",
                    fontSize: 12,
                    fontWeight: 500,
                    borderRadius: "var(--radius)",
                    border: active
                      ? "0.5px solid var(--border-accent)"
                      : "0.5px solid var(--border)",
                    background: active
                      ? "var(--bg-accent)"
                      : "var(--surface-0)",
                    color: active
                      ? "var(--text-accent)"
                      : "var(--text-secondary)",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              );
            })}
            {form.salary && (
              <button
                onClick={() => set("salary", undefined)}
                style={{
                  padding: "5px 10px",
                  fontSize: 12,
                  borderRadius: "var(--radius)",
                  border: "0.5px solid var(--border)",
                  background: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {form.salary && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Label>Min</Label>
              <input
                type="number"
                value={form.salary.min ?? ""}
                onChange={(e) =>
                  set("salary", {
                    ...form.salary!,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="0"
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Label>Max</Label>
              <input
                type="number"
                value={form.salary.max ?? ""}
                onChange={(e) =>
                  set("salary", {
                    ...form.salary!,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                placeholder="No limit"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Bottom save bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          paddingTop: 8,
        }}
      >
        <button
          onClick={() => setForm(config)}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            borderRadius: "var(--radius)",
            border: "0.5px solid var(--border-strong)",
            background: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
        >
          Discard changes
        </button>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 500,
            background: saving ? "var(--surface-1)" : "var(--fill-primary)",
            color: saving ? "var(--text-muted)" : "var(--on-primary)",
            border: "none",
            borderRadius: "var(--radius)",
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}