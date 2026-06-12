import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const STEP_LABELS = [
  "Basics",
  "Fields",
  "Skills",
  "Locations",
  "Preferences",
  "Summary",
];

interface WizardShellProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onNextLabel?: string;
  nextDisabled?: boolean;
  saving?: boolean;
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

export default function WizardShell({
  step,
  totalSteps,
  onBack,
  onNext,
  onNextLabel,
  nextDisabled,
  saving,
  children,
  title,
  subtitle,
}: WizardShellProps) {
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Top progress bar */}
      <div className="h-0.5 bg-zinc-100 w-full fixed top-0 left-0 z-50">
        <div
          className="h-full bg-zinc-900 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-zinc-100 pt-0.5">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            JobScout
          </span>
          <div className="flex items-center gap-1.5">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 ${
                      active
                        ? "bg-zinc-900 text-white"
                        : done
                        ? "bg-zinc-100 text-zinc-500"
                        : "text-zinc-300"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        active
                          ? "bg-white text-zinc-900"
                          : done
                          ? "bg-zinc-400 text-white"
                          : "bg-zinc-200 text-zinc-400"
                      }`}
                    >
                      {done ? "✓" : n}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`w-4 h-px ${done ? "bg-zinc-300" : "bg-zinc-100"}`} />
                  )}
                </div>
              );
            })}
          </div>
          <span className="text-xs text-zinc-400">{step} / {totalSteps}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pt-20 pb-28 max-w-3xl mx-auto w-full px-6">
        {/* Step header */}
        <div className="mb-8 mt-6">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">
            Step {step} of {totalSteps}
          </p>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">{title}</h1>
          <p className="text-sm text-zinc-500 mt-1.5 leading-relaxed">{subtitle}</p>
        </div>

        {children}
      </div>

      {/* Footer nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 z-40">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={onBack}
            disabled={step === 1}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors px-3 py-2 rounded-md hover:bg-zinc-50"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <button
            onClick={onNext}
            disabled={nextDisabled || saving}
            className="flex items-center gap-1.5 bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving...</>
            ) : (
              <>{onNextLabel ?? "Continue"} <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}