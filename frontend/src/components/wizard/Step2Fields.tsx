import { useEffect, useState } from "react";
import type { WizardFormState } from "../../types/dashboard";
import { X } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MAX_INCLUDE_FIELDS = 3;

interface Props {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void;
}

export default function Step2Fields({ form, update }: Props) {
  const [allFields, setAllFields] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/meta/fields`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        // Handle both flat array and dict shapes
        if (Array.isArray(data)) setAllFields(data);
        else setAllFields(Object.keys(data));
      })
      .catch(() => setAllFields([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = allFields.filter(
    (f) =>
      f.toLowerCase().includes(search.toLowerCase()) &&
      !form.include_fields.includes(f) &&
      !form.exclude_fields.includes(f)
  );

  const addInclude = (field: string) => {
    if (form.include_fields.length >= MAX_INCLUDE_FIELDS) return;
    update("include_fields", [...form.include_fields, field]);
  };

  const addExclude = (field: string) => {
    update("exclude_fields", [...form.exclude_fields, field]);
  };

  const removeInclude = (field: string) => {
    update("include_fields", form.include_fields.filter((f) => f !== field));
  };

  const removeExclude = (field: string) => {
    update("exclude_fields", form.exclude_fields.filter((f) => f !== field));
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs font-semibold text-blue-700 mb-0.5">How fields work</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          Fields are broad job categories (e.g. "Software Engineering", "Data Science"). You can pick up to <strong>3 to include</strong> — these act as hard filters, only jobs matching at least one will appear. Excluded fields are always blocked.
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-zinc-800">Search fields</label>
        <input
          type="text"
          placeholder="e.g. Software Engineering, Data Science..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
        />
      </div>

      {/* Field list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin" />
          Loading fields...
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
          {filtered.slice(0, 60).map((field) => (
            <div key={field} className="flex items-center gap-1 border border-zinc-200 rounded-md overflow-hidden">
              <span className="text-xs text-zinc-700 px-2.5 py-1.5">{field}</span>
              <button
                onClick={() => addInclude(field)}
                disabled={form.include_fields.length >= MAX_INCLUDE_FIELDS}
                title="Include"
                className="px-2 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-30 disabled:cursor-not-allowed border-l border-zinc-200 transition-colors"
              >+</button>
              <button
                onClick={() => addExclude(field)}
                title="Exclude"
                className="px-2 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 border-l border-zinc-200 transition-colors"
              >−</button>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400">No fields match your search.</p>
          )}
        </div>
      )}

      {/* Selected */}
      <div className="grid grid-cols-2 gap-4">
        {/* Included */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            Included ({form.include_fields.length}/{MAX_INCLUDE_FIELDS})
          </p>
          {form.include_fields.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">None selected</p>
          ) : (
            form.include_fields.map((f) => (
              <div key={f} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1.5">
                <span className="text-xs font-medium text-emerald-800">{f}</span>
                <button onClick={() => removeInclude(f)} className="text-emerald-500 hover:text-emerald-700 ml-2">
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Excluded */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Excluded</p>
          {form.exclude_fields.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">None selected</p>
          ) : (
            form.exclude_fields.map((f) => (
              <div key={f} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                <span className="text-xs font-medium text-red-800">{f}</span>
                <button onClick={() => removeExclude(f)} className="text-red-400 hover:text-red-600 ml-2">
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary */}
      {(form.include_fields.length > 0 || form.exclude_fields.length > 0) && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">What this means</p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {form.include_fields.length > 0 && (
              <>Jobs must fall under <span className="font-semibold text-zinc-900">{form.include_fields.join(", ")}</span>. </>
            )}
            {form.exclude_fields.length > 0 && (
              <>Jobs in <span className="font-semibold text-zinc-900">{form.exclude_fields.join(", ")}</span> will be blocked entirely.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}