import { useDashboardWizard } from "../hooks/useDashboardWizard";
import WizardShell from "../components/wizard/WizardShell";
import Step1Basics from "../components/wizard/Step1Basics";
import Step2Fields from "../components/wizard/Step2Fields";
import Step3Skills from "../components/wizard/Step3Skills";
import Step4Locations from "../components/wizard/Step4Locations";
import Step5Prefs from "../components/wizard/Step5Prefs";
import Step6Summary from "../components/wizard/Step6Summary";

const STEP_META = [
  {
    title: "Let's set up your dashboard",
    subtitle: "Give it a name and tell us what kind of roles you're looking for. You can create multiple dashboards for different targets.",
  },
  {
    title: "What fields are you targeting?",
    subtitle: "Fields are broad job categories. Pick up to 3 you want to include — jobs must match at least one. Excluded fields are always blocked.",
  },
  {
    title: "Which skills matter to you?",
    subtitle: "Based on your selected fields, vote on skills. Included skills boost a job's score. Excluded skills hide matching jobs entirely.",
  },
  {
    title: "Locations & companies",
    subtitle: "Pick where you want to work and any companies you care about. Set each as a preference (score boost) or a hard filter (strict match only).",
  },
  {
    title: "Final preferences",
    subtitle: "Optionally set your target seasons, work term length, date range, and salary expectations. All of these are optional.",
  },
  {
    title: "Review & launch",
    subtitle: "Here's everything you configured. Click any section to go back and edit. When you're ready, launch your dashboard.",
  },
];

export default function NewDashboardPage() {
  const wizard = useDashboardWizard();
  const meta = STEP_META[wizard.step - 1];

  const isNextDisabled = () => {
    if (wizard.step === 1) return !wizard.form.name || wizard.form.job_types.length === 0;
    if (wizard.step === 2) return wizard.form.include_fields.length === 0;
    return false;
  };

  const handleNext = async () => {
    // Auto-save draft on step 5 → 6
    if (wizard.step === 5) {
      await wizard.saveDraft();
    }
    wizard.next();
  };

  return (
    <WizardShell
      step={wizard.step}
      totalSteps={wizard.TOTAL_STEPS}
      onBack={wizard.back}
      onNext={handleNext}
      onNextLabel={wizard.step === 5 ? "Save & Review" : wizard.step === 6 ? undefined : "Continue"}
      nextDisabled={isNextDisabled() || wizard.step === 6}
      saving={wizard.saving}
      title={meta.title}
      subtitle={meta.subtitle}
    >
      {wizard.step === 1 && (
        <Step1Basics form={wizard.form} update={wizard.update} />
      )}
      {wizard.step === 2 && (
        <Step2Fields form={wizard.form} update={wizard.update} />
      )}
      {wizard.step === 3 && (
        <Step3Skills form={wizard.form} update={wizard.update} />
      )}
      {wizard.step === 4 && (
        <Step4Locations form={wizard.form} update={wizard.update} />
      )}
      {wizard.step === 5 && (
        <Step5Prefs form={wizard.form} update={wizard.update} />
      )}
      {wizard.step === 6 && (
        <Step6Summary
          form={wizard.form}
          onLaunch={wizard.launch}
          launching={wizard.launching}
          error={wizard.error}
          goTo={wizard.goTo}
        />
      )}
    </WizardShell>
  );
}