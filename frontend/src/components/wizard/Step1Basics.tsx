import { type WizardFormState, JOB_TYPE_LABELS, type JobType } from "../../types/dashboard";

interface Props {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void;
}

const JOB_TYPES = Object.entries(JOB_TYPE_LABELS) as [JobType, string][];

const JOB_TYPE_DESCRIPTIONS: Record<JobType, string> = {
  "co-op": "Structured work term tied to your academic program, usually 4–8 months.",
  internship: "Short-term placement, often 3–6 months, may or may not be credit-bearing.",
  "full-time": "Permanent or long-term role, typically 40hrs/week.",
  "part-time": "Reduced hours role, flexible around studies.",
  contract: "Fixed-term engagement with a defined end date.",
};

export default function Step1Basics({ form, update }: Props) {
  const toggleJobType = (jt: JobType) => {
    const current = form.job_types as JobType[];
    if (current.includes(jt)) {
      update("job_types", current.filter((t) => t !== jt));
    } else {
      update("job_types", [...current, jt]);
    }
  };

  const hasCoopOrIntern =
    form.job_types.includes("co-op") || form.job_types.includes("internship");

  return (
    <div className="flex flex-col gap-6">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-zinc-800">Dashboard name <span className="text-red-400">*</span></label>
        <input
          type="text"
          placeholder="e.g. Fall 2026 SWE Co-ops"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
        />
        <p className="text-xs text-zinc-400">Give it a name that reflects what you're targeting — you can have multiple dashboards.</p>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-zinc-800">Description <span className="text-zinc-400 font-normal">(optional)</span></label>
        <textarea
          rows={2}
          placeholder="e.g. Targeting backend and infrastructure roles in Canada for Fall 2026"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition resize-none"
        />
      </div>

      {/* Job types */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-zinc-800">Job type <span className="text-red-400">*</span></label>
        <p className="text-xs text-zinc-400 -mt-1">Select all that apply. You can mix co-op with internship if you're open to both.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          {JOB_TYPES.map(([type, label]) => {
            const selected = (form.job_types as JobType[]).includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleJobType(type)}
                className={`flex flex-col gap-0.5 text-left px-3.5 py-3 rounded-lg border text-sm transition-all ${
                  selected
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
                }`}
              >
                <span className="font-semibold">{label}</span>
                <span className={`text-[11px] leading-snug ${selected ? "text-zinc-300" : "text-zinc-400"}`}>
                  {JOB_TYPE_DESCRIPTIONS[type]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary box */}
      {(form.name || form.job_types.length > 0) && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-3 mt-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">What this means</p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {form.name ? (
              <>Your dashboard <span className="font-semibold text-zinc-900">"{form.name}"</span> will {" "}</>
            ) : (
              <>This dashboard will {" "}</>
            )}
            {form.job_types.length > 0 ? (
              <>surface <span className="font-semibold text-zinc-900">{form.job_types.map(t => JOB_TYPE_LABELS[t as JobType]).join(", ")}</span> positions.</>
            ) : (
              <>surface jobs once you select a type above.</>
            )}
            {hasCoopOrIntern && " You'll configure work term details in Step 5."}
          </p>
        </div>
      )}
    </div>
  );
}