import { useNavigate } from "react-router-dom";
import { type WizardFormState, JOB_TYPE_LABELS, SEASON_LABELS, type JobType, type Season } from "../../types/dashboard"
import { Loader2, Rocket, ExternalLink } from "lucide-react";

interface Props {
  form: WizardFormState;
  onLaunch: () => Promise<string | null>;
  launching: boolean;
  error: string | null;
  goTo: (step: number) => void;
}

function SummarySection({
  title,
  step,
  goTo,
  children,
}: {
  title: string;
  step: number;
  goTo: (s: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-zinc-100 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-100">
        <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">{title}</p>
        <button
          onClick={() => goTo(step)}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          Edit <ExternalLink size={11} />
        </button>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function Tag({ label, variant }: { label: string; variant: "include" | "exclude" | "neutral" }) {
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${
      variant === "include" ? "bg-emerald-100 text-emerald-800"
      : variant === "exclude" ? "bg-red-100 text-red-800"
      : "bg-zinc-100 text-zinc-600"
    }`}>
      {variant === "include" ? "+ " : variant === "exclude" ? "− " : ""}{label}
    </span>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-xs text-zinc-400 italic">{text}</p>;
}

export default function Step6Summary({ form, onLaunch, launching, error, goTo }: Props) {
  const navigate = useNavigate();

  const handleLaunch = async () => {
    const configId = await onLaunch();
    if (configId) {
      navigate("/dashboard/jobs");
    }
  };

  return (
    <div className="flex flex-col gap-5">

      <div className="bg-zinc-900 text-white rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Ready to launch</p>
        <p className="text-lg font-bold">{form.name || "Unnamed Dashboard"}</p>
        {form.description && <p className="text-sm text-zinc-400 mt-0.5">{form.description}</p>}
      </div>

      {/* Step 1 */}
      <SummarySection title="Basics" step={1} goTo={goTo}>
        <div className="flex flex-wrap gap-1.5">
          {form.job_types.length > 0 ? (
            form.job_types.map((jt) => (
              <Tag key={jt} label={JOB_TYPE_LABELS[jt as JobType]} variant="neutral" />
            ))
          ) : (
            <EmptyNote text="No job types selected" />
          )}
        </div>
      </SummarySection>

      {/* Step 2 */}
      <SummarySection title="Fields" step={2} goTo={goTo}>
        {form.include_fields.length === 0 && form.exclude_fields.length === 0 ? (
          <EmptyNote text="No field filters set" />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {form.include_fields.map((f) => <Tag key={f} label={f} variant="include" />)}
            {form.exclude_fields.map((f) => <Tag key={f} label={f} variant="exclude" />)}
          </div>
        )}
      </SummarySection>

      {/* Step 3 */}
      <SummarySection title="Skills" step={3} goTo={goTo}>
        {form.include_skills.length === 0 && form.exclude_skills.length === 0 ? (
          <EmptyNote text="No skill filters set" />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {form.include_skills.map((s) => <Tag key={s} label={s} variant="include" />)}
            {form.exclude_skills.map((s) => <Tag key={s} label={s} variant="exclude" />)}
          </div>
        )}
      </SummarySection>

      {/* Step 4 */}
      <SummarySection title="Locations & Companies" step={4} goTo={goTo}>
        <div className="flex flex-col gap-3">
          {form.include_locations.length === 0 && form.exclude_locations.length === 0 && form.include_companies.length === 0 && form.exclude_companies.length === 0 ? (
            <EmptyNote text="No location or company filters set" />
          ) : (
            <>
              {(form.include_locations.length > 0 || form.exclude_locations.length > 0) && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Locations ({form.location_mode})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.include_locations.map((l) => <Tag key={l} label={l} variant="include" />)}
                    {form.exclude_locations.map((l) => <Tag key={l} label={l} variant="exclude" />)}
                  </div>
                </div>
              )}
              {(form.include_companies.length > 0 || form.exclude_companies.length > 0) && (
                <div>
                  <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
                    Companies ({form.company_mode})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.include_companies.map((c) => <Tag key={c} label={c} variant="include" />)}
                    {form.exclude_companies.map((c) => <Tag key={c} label={c} variant="exclude" />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SummarySection>

      {/* Step 5 */}
      <SummarySection title="Preferences" step={5} goTo={goTo}>
        <div className="flex flex-col gap-2 text-sm text-zinc-700">
          <div className="flex flex-wrap gap-1.5">
            {form.seasons.length > 0 ? (
              form.seasons.map((s) => <Tag key={s} label={SEASON_LABELS[s as Season]} variant="neutral" />)
            ) : (
              <EmptyNote text="No season selected" />
            )}
          </div>
          {form.work_term_duration && (
            <p className="text-xs text-zinc-500">Work term: <span className="font-semibold text-zinc-800">{form.work_term_duration}</span></p>
          )}
          {form.salary && (form.salary.min || form.salary.max) && (
            <p className="text-xs text-zinc-500">
              Salary: <span className="font-semibold text-zinc-800">
                {form.salary.min ? `$${form.salary.min}` : "any"} – {form.salary.max ? `$${form.salary.max}` : "any"} {form.salary.type}
              </span>
            </p>
          )}
          {form.date_range && (form.date_range.start || form.date_range.end) && (
            <p className="text-xs text-zinc-500">
              Date range: <span className="font-semibold text-zinc-800">
                {form.date_range.start ?? "any"} → {form.date_range.end ?? "any"}
              </span>
            </p>
          )}
        </div>
      </SummarySection>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Launch */}
      <button
        onClick={handleLaunch}
        disabled={launching || !form.name || form.job_types.length === 0}
        className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-semibold text-sm px-6 py-3.5 rounded-xl hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all w-full mt-2"
      >
        {launching ? (
          <><Loader2 size={16} className="animate-spin" /> Launching...</>
        ) : (
          <><Rocket size={16} /> Launch Dashboard</>
        )}
      </button>

      {(!form.name || form.job_types.length === 0) && (
        <p className="text-xs text-zinc-400 text-center -mt-2">
          Dashboard name and at least one job type are required to launch.
        </p>
      )}
    </div>
  );
}