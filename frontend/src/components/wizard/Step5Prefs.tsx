/* eslint-disable @typescript-eslint/no-explicit-any */
import { type WizardFormState, type Season, SEASON_LABELS, WORK_DURATIONS, type SalaryType } from "../../types/dashboard";

interface Props {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void;
}

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const SEASONS = Object.entries(SEASON_LABELS) as [Season, string][];

const hasCoopOrIntern = (form: WizardFormState) =>
  form.job_types.includes("co-op") || form.job_types.includes("internship");

export default function Step5Prefs({ form, update }: Props) {
  const isCoop = hasCoopOrIntern(form);

  const toggleSeason = (season: Season) => {
    const current = form.seasons;
    if (current.includes(season)) {
      update("seasons", current.filter((s) => s !== season));
    } else {
      update("seasons", [...current, season]);
    }
  };

  const salaryType = form.salary?.type ?? "hourly";
  const salaryMin = form.salary?.min ?? "";
  const salaryMax = form.salary?.max ?? "";

  const updateSalary = (field: "type" | "min" | "max", value: any) => {
    update("salary", {
      type: salaryType,
      min: salaryMin ? Number(salaryMin) : undefined,
      max: salaryMax ? Number(salaryMax) : undefined,
      ...form.salary,
      [field]: value === "" ? undefined : field === "type" ? value : Number(value),
    });
  };

  return (
    <div className="flex flex-col gap-7">

      {/* Seasons */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Seasons</h3>
          <p className="text-xs text-zinc-400 mt-0.5">Which work terms are you targeting? Select all that apply.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SEASONS.map(([season, label]) => {
            const selected = form.seasons.includes(season);
            return (
              <button
                key={season}
                onClick={() => toggleSeason(season)}
                className={`px-4 py-3 rounded-lg border text-left text-sm font-medium transition-all ${
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Work term duration — only for co-op/intern */}
      {isCoop && (
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">Work term duration</h3>
            <p className="text-xs text-zinc-400 mt-0.5">How long are you looking to work?</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {WORK_DURATIONS.map((d) => (
              <button
                key={d}
                onClick={() => update("work_term_duration", form.work_term_duration === d ? undefined : d)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  form.work_term_duration === d
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Date range <span className="text-zinc-400 font-normal">(optional)</span></h3>
          <p className="text-xs text-zinc-400 mt-0.5">Only show jobs posted within this window.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">From</label>
            <input
              type="date"
              value={form.date_range?.start ?? ""}
              onChange={(e) => update("date_range", { ...form.date_range, start: e.target.value || undefined })}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">To</label>
            <input
              type="date"
              value={form.date_range?.end ?? ""}
              onChange={(e) => update("date_range", { ...form.date_range, end: e.target.value || undefined })}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
            />
          </div>
        </div>
      </div>

      {/* Salary */}
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Salary expectation <span className="text-zinc-400 font-normal">(optional)</span></h3>
          <p className="text-xs text-zinc-400 mt-0.5">Filter or sort jobs based on compensation. Leave blank to ignore.</p>
        </div>

        {/* Salary type */}
        <div className="flex gap-1.5 flex-wrap">
          {SALARY_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => updateSalary("type", value)}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition-all ${
                salaryType === value
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Min ({salaryType})</label>
            <input
              type="number"
              placeholder="e.g. 20"
              value={salaryMin}
              onChange={(e) => updateSalary("min", e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500">Max ({salaryType})</label>
            <input
              type="number"
              placeholder="e.g. 50"
              value={salaryMax}
              onChange={(e) => updateSalary("max", e.target.value)}
              className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-3">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">What this means</p>
        <p className="text-sm text-zinc-700 leading-relaxed">
          {form.seasons.length > 0 ? (
            <>Targeting <span className="font-semibold text-zinc-900">{form.seasons.map(s => SEASON_LABELS[s]).join(", ")}</span>. </>
          ) : "No season filter set. "}
          {isCoop && form.work_term_duration && (
            <>Work term of <span className="font-semibold text-zinc-900">{form.work_term_duration}</span>. </>
          )}
          {form.salary?.min || form.salary?.max ? (
            <>Salary range: <span className="font-semibold text-zinc-900">
              {form.salary.min ? `$${form.salary.min}` : "any"} – {form.salary.max ? `$${form.salary.max}` : "any"} {form.salary.type}
            </span>.</>
          ) : "No salary filter."}
        </p>
      </div>
    </div>
  );
}