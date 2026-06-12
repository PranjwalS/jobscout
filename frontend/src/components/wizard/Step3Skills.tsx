/* eslint-disable no-useless-assignment */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { WizardFormState } from "../../types/dashboard";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type SkillVote = "include" | "neutral" | "exclude";

interface Props {
  form: WizardFormState;
  update: <K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) => void;
}

export default function Step3Skills({ form, update }: Props) {
  const [allSkills, setAllSkills] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, SkillVote>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const fields = form.include_fields.join(",");
    const url = fields
      ? `${API}/meta/skills-by-fields?fields=${encodeURIComponent(fields)}`
      : `${API}/meta/skills`;

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        let skills: string[] = [];
        if (Array.isArray(data)) skills = data;
        else skills = Object.values(data as Record<string, string[]>).flat();
        setAllSkills([...new Set(skills)]);
      })
      .catch(() => setAllSkills([]))
      .finally(() => setLoading(false));
  }, [form.include_fields]);

  // Sync votes from form state on mount
  useEffect(() => {
    const initial: Record<string, SkillVote> = {};
    form.include_skills.forEach((s) => (initial[s] = "include"));
    form.exclude_skills.forEach((s) => (initial[s] = "exclude"));
    setVotes(initial);
  }, []);

  const setVote = (skill: string, vote: SkillVote) => {
    const prev = votes[skill] ?? "neutral";
    const newVote = prev === vote ? "neutral" : vote; // toggle off
    setVotes((v) => ({ ...v, [skill]: newVote }));

    // Sync to form
    const includes = new Set(form.include_skills);
    const excludes = new Set(form.exclude_skills);
    includes.delete(skill);
    excludes.delete(skill);
    if (newVote === "include") includes.add(skill);
    if (newVote === "exclude") excludes.add(skill);
    update("include_skills", [...includes]);
    update("exclude_skills", [...excludes]);
  };

  const filtered = allSkills.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  const included = allSkills.filter((s) => votes[s] === "include");
  const excluded = allSkills.filter((s) => votes[s] === "exclude");

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs font-semibold text-blue-700 mb-0.5">How skills work</p>
        <p className="text-xs text-blue-600 leading-relaxed">
          Skills shown here are filtered to your selected fields. <strong>+ Include</strong> boosts jobs that list this skill. <strong>− Exclude</strong> hides jobs requiring it. Neutral has no effect. You can change these anytime.
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search skills..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-zinc-200 rounded-lg px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <div className="w-4 h-4 border-2 border-zinc-200 border-t-zinc-500 rounded-full animate-spin" />
          Loading skills for your fields...
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {filtered.slice(0, 80).map((skill) => {
            const vote = votes[skill] ?? "neutral";
            return (
              <div
                key={skill}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-all ${
                  vote === "include"
                    ? "bg-emerald-50 border-emerald-200"
                    : vote === "exclude"
                    ? "bg-red-50 border-red-200"
                    : "bg-white border-zinc-100 hover:border-zinc-200"
                }`}
              >
                <span className={`text-sm font-medium ${
                  vote === "include" ? "text-emerald-800"
                  : vote === "exclude" ? "text-red-800"
                  : "text-zinc-700"
                }`}>{skill}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setVote(skill, "include")}
                    title="Include (preference boost)"
                    className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${
                      vote === "include"
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-emerald-100 hover:text-emerald-700"
                    }`}
                  >+</button>
                  <button
                    onClick={() => setVote(skill, "neutral")}
                    title="Neutral"
                    className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${
                      vote === "neutral"
                        ? "bg-zinc-300 text-zinc-700"
                        : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                    }`}
                  >·</button>
                  <button
                    onClick={() => setVote(skill, "exclude")}
                    title="Exclude"
                    className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${
                      vote === "exclude"
                        ? "bg-red-500 text-white"
                        : "bg-zinc-100 text-zinc-500 hover:bg-red-100 hover:text-red-600"
                    }`}
                  >−</button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400 py-4 text-center">No skills match your search.</p>
          )}
        </div>
      )}

      {/* Summary */}
      {(included.length > 0 || excluded.length > 0) && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">What this means</p>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {included.length > 0 && (
              <>Jobs mentioning <span className="font-semibold text-zinc-900">{included.slice(0, 5).join(", ")}{included.length > 5 ? ` +${included.length - 5} more` : ""}</span> will be scored higher. </>
            )}
            {excluded.length > 0 && (
              <>Jobs requiring <span className="font-semibold text-zinc-900">{excluded.slice(0, 3).join(", ")}{excluded.length > 3 ? ` +${excluded.length - 3} more` : ""}</span> will be hidden.</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}