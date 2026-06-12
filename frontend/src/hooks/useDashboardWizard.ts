/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback } from "react";
import { type WizardFormState, EMPTY_FORM } from "../types/dashboard";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function useDashboardWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [createdConfigId, setCreatedConfigId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const TOTAL_STEPS = 6;

  const update = useCallback(<K extends keyof WizardFormState>(
    key: K,
    value: WizardFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleListItem = useCallback(<T extends string>(
    key: keyof WizardFormState,
    item: T
  ) => {
    setForm((prev) => {
      const list = (prev[key] as T[]) ?? [];
      const exists = list.includes(item);
      return {
        ...prev,
        [key]: exists ? list.filter((i) => i !== item) : [...list, item],
      };
    });
  }, []);

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));
  const goTo = (s: number) => setStep(s);

  // Save config (create or update draft)
  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(form);

      if (createdConfigId) {
        // PATCH existing
        const res = await fetch(`${API}/dashboard-configs/${createdConfigId}`, {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to save");
        return await res.json();
      } else {
        // POST new
        const res = await fetch(`${API}/dashboard-configs`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        const data = await res.json();
        setCreatedConfigId(data.id);
        return data;
      }
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const launch = async () => {
    setLaunching(true);
    setError(null);
    try {
      // Save first if needed
      let configId = createdConfigId;
      if (!configId) {
        const saved = await saveDraft();
        if (!saved) return null;
        configId = saved.id;
      } else {
        await saveDraft();
      }

      const res = await fetch(`${API}/dashboard-configs/${configId}/launch`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed to launch");

      // Trigger initial sync
      fetch(`${API}/dashboard-configs/${configId}/sync`, {
        method: "POST",
        headers: authHeaders(),
      }).catch(() => {}); // fire and forget

      return configId;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLaunching(false);
    }
  };

  return {
    step,
    form,
    update,
    toggleListItem,
    next,
    back,
    goTo,
    saveDraft,
    launch,
    saving,
    launching,
    createdConfigId,
    error,
    TOTAL_STEPS,
  };
}

function buildPayload(form: WizardFormState) {
  return {
    name: form.name,
    description: form.description || undefined,
    job_types: form.job_types,
    include_fields: form.include_fields,
    exclude_fields: form.exclude_fields,
    include_skills: form.include_skills,
    exclude_skills: form.exclude_skills,
    include_locations: form.include_locations,
    exclude_locations: form.exclude_locations,
    location_mode: form.location_mode,
    include_companies: form.include_companies,
    exclude_companies: form.exclude_companies,
    company_mode: form.company_mode,
    salary: form.salary,
    seasons: form.seasons,
    work_term_duration: form.work_term_duration,
    date_range: form.date_range,
  };
}