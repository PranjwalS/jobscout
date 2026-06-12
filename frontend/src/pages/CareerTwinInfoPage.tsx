/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import {
  Plus, Trash2, Loader2, ChevronDown, ChevronUp,
  Briefcase, GraduationCap, Folder, X, Check,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const token = () => localStorage.getItem("token") || "";

// ── Types ─────────────────────────────────────────────────────────────────

type Experience = {
  id: string;
  company: string;
  role: string;
  location: string;
  start_date: string;
  end_date: string;
  responsibilities: string[];
};

type Education = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  gpa: string | null;
  start_date: string;
  end_date: string;
  details: string[];
};

type Project = {
  id: string;
  name: string;
  description: string[];
  start_date: string;
  end_date: string;
  links: string[];
  tech_stack: string[];
};

type InfoData = {
  experience: Experience[];
  education: Education[];
  projects: Project[];
  skills: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────

function BulletListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const update = (i: number, val: string) => onChange(items.map((x, idx) => idx === i ? val : x));
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-zinc-300 mt-2.5 shrink-0">•</span>
          <input
            type="text"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors"
          />
          <button onClick={() => remove(i)} className="p-1.5 text-zinc-300 hover:text-red-400 transition-colors mt-0.5 shrink-0">
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 mt-1 transition-colors"
      >
        <Plus size={11} /> Add point
      </button>
    </div>
  );
}

function TagEditor({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setInput("");
  };
  const remove = (i: number) => onChange(tags.filter((_, idx) => idx !== i));
  return (
    <div className="flex flex-wrap gap-1.5 items-center border border-zinc-200 rounded-md px-3 py-2 focus-within:border-zinc-400 transition-colors">
      {tags.map((t, i) => (
        <span key={i} className="flex items-center gap-1 bg-zinc-100 text-zinc-700 text-xs px-2 py-0.5 rounded-full">
          {t}
          <button onClick={() => remove(i)} className="text-zinc-400 hover:text-zinc-700"><X size={10} /></button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        placeholder={placeholder}
        className="text-sm outline-none flex-1 min-w-20 bg-transparent"
      />
    </div>
  );
}

// ── Experience card ───────────────────────────────────────────────────────

function ExperienceCard({
  exp,
  onUpdate,
  onDelete,
}: {
  exp: Experience;
  onUpdate: (id: string, data: Partial<Experience>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(exp);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(exp);

  const save = async () => {
    setSaving(true);
    await onUpdate(exp.id, draft);
    setSaving(false);
  };

  const del = async () => {
    setDeleting(true);
    await onDelete(exp.id);
  };

  const sf = (key: keyof Experience, val: string) => setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div className="bg-white border border-zinc-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
            <Briefcase size={14} className="text-zinc-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{exp.role}</p>
            <p className="text-xs text-zinc-400">{exp.company} · {exp.start_date} – {exp.end_date}</p>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-400 shrink-0" /> : <ChevronDown size={14} className="text-zinc-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-zinc-50 pt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Role</label>
              <input type="text" value={draft.role} onChange={(e) => sf("role", e.target.value)}
                className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Company</label>
              <input type="text" value={draft.company} onChange={(e) => sf("company", e.target.value)}
                className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Location</label>
              <input type="text" value={draft.location} onChange={(e) => sf("location", e.target.value)}
                className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Start date</label>
              <input type="text" value={draft.start_date} onChange={(e) => sf("start_date", e.target.value)}
                placeholder="May 2024" className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">End date</label>
              <input type="text" value={draft.end_date} onChange={(e) => sf("end_date", e.target.value)}
                placeholder="Aug 2024 or Present" className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Responsibilities</label>
            <BulletListEditor
              items={draft.responsibilities}
              onChange={(v) => setDraft((d) => ({ ...d, responsibilities: v }))}
              placeholder="What did you do here?"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={del} disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
              <Trash2 size={12} /> {deleting ? "Deleting..." : "Delete"}
            </button>
            <button onClick={save} disabled={saving || !isDirty}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Education card ────────────────────────────────────────────────────────

function EducationCard({
  edu,
  onUpdate,
  onDelete,
}: {
  edu: Education;
  onUpdate: (id: string, data: Partial<Education>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(edu);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(edu);
  const save = async () => { setSaving(true); await onUpdate(edu.id, draft); setSaving(false); };
  const del = async () => { setDeleting(true); await onDelete(edu.id); };
  const sf = (key: keyof Education, val: string) => setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div className="bg-white border border-zinc-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
            <GraduationCap size={14} className="text-zinc-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{edu.degree} in {edu.field}</p>
            <p className="text-xs text-zinc-400">{edu.institution} · {edu.start_date} – {edu.end_date}</p>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-400 shrink-0" /> : <ChevronDown size={14} className="text-zinc-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-zinc-50 pt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "institution" as const, label: "Institution", placeholder: "University of Waterloo" },
              { key: "degree" as const, label: "Degree", placeholder: "Bachelor of Mathematics" },
              { key: "field" as const, label: "Field", placeholder: "Computer Science" },
              { key: "gpa" as const, label: "GPA", placeholder: "3.9 / 4.0" },
              { key: "start_date" as const, label: "Start", placeholder: "Sep 2023" },
              { key: "end_date" as const, label: "End", placeholder: "Apr 2027" },
            ].map(({ key, label, placeholder }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">{label}</label>
                <input type="text" value={draft[key] || ""} onChange={(e) => sf(key, e.target.value)}
                  placeholder={placeholder}
                  className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Details / Notable courses</label>
            <BulletListEditor
              items={draft.details}
              onChange={(v) => setDraft((d) => ({ ...d, details: v }))}
              placeholder="Notable course or achievement"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={del} disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
              <Trash2 size={12} /> {deleting ? "Deleting..." : "Delete"}
            </button>
            <button onClick={save} disabled={saving || !isDirty}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────

function ProjectCard({
  proj,
  onUpdate,
  onDelete,
}: {
  proj: Project;
  onUpdate: (id: string, data: Partial<Project>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(proj);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(proj);
  const save = async () => { setSaving(true); await onUpdate(proj.id, draft); setSaving(false); };
  const del = async () => { setDeleting(true); await onDelete(proj.id); };
  const sf = (key: keyof Project, val: string) => setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div className="bg-white border border-zinc-100 rounded-lg overflow-hidden">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-50 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center shrink-0">
            <Folder size={14} className="text-zinc-500" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-semibold text-zinc-900 truncate">{proj.name}</p>
            <p className="text-xs text-zinc-400">{proj.start_date} – {proj.end_date}</p>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-zinc-400 shrink-0" /> : <ChevronDown size={14} className="text-zinc-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-zinc-50 pt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Project name</label>
              <input type="text" value={draft.name} onChange={(e) => sf("name", e.target.value)}
                className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Start date</label>
              <input type="text" value={draft.start_date} onChange={(e) => sf("start_date", e.target.value)}
                placeholder="Jan 2025" className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">End date</label>
              <input type="text" value={draft.end_date} onChange={(e) => sf("end_date", e.target.value)}
                placeholder="Present" className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Description</label>
            <BulletListEditor
              items={draft.description}
              onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
              placeholder="What does this project do?"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Tech stack</label>
            <TagEditor
              tags={draft.tech_stack}
              onChange={(v) => setDraft((d) => ({ ...d, tech_stack: v }))}
              placeholder="React, Python... (press Enter)"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Links</label>
            <TagEditor
              tags={draft.links}
              onChange={(v) => setDraft((d) => ({ ...d, links: v }))}
              placeholder="https://github.com/... (press Enter)"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={del} disabled={deleting}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
              <Trash2 size={12} /> {deleting ? "Deleting..." : "Delete"}
            </button>
            <button onClick={save} disabled={saving || !isDirty}
              className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add modal ─────────────────────────────────────────────────────────────

type AddType = "experience" | "education" | "project";

function AddModal({ onClose, onAdd }: { onClose: () => void; onAdd: (section: string, data: object) => Promise<void> }) {
  const [type, setType] = useState<AddType>("experience");
  const [saving, setSaving] = useState(false);

  const [exp, setExp] = useState<Omit<Experience, "id">>({
    company: "", role: "", location: "", start_date: "", end_date: "", responsibilities: [""],
  });
  const [edu, setEdu] = useState<Omit<Education, "id">>({
    institution: "", degree: "", field: "", gpa: "", start_date: "", end_date: "", details: [],
  });
  const [proj, setProj] = useState<Omit<Project, "id">>({
    name: "", description: [""], start_date: "", end_date: "", links: [], tech_stack: [],
  });

  const handleAdd = async () => {
    setSaving(true);
    const sectionMap = { experience: "experiences", education: "education", project: "projects" };
    const dataMap = { experience: exp, education: edu, project: proj };
    await onAdd(sectionMap[type], dataMap[type]);
    setSaving(false);
    onClose();
  };

  const sf_exp = (k: keyof typeof exp, v: string) => setExp((d) => ({ ...d, [k]: v }));
  const sf_edu = (k: keyof typeof edu, v: string) => setEdu((d) => ({ ...d, [k]: v }));
  const sf_proj = (k: keyof typeof proj, v: string) => setProj((d) => ({ ...d, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-zinc-100 shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white">
          <h2 className="text-sm font-bold text-zinc-900">Add new entry</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">
          {/* Type picker */}
          <div className="flex gap-2">
            {(["experience", "education", "project"] as AddType[]).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 text-xs font-medium py-2 rounded-md border transition-colors capitalize ${type === t ? "bg-zinc-900 text-white border-zinc-900" : "border-zinc-200 text-zinc-500 hover:border-zinc-400"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Experience fields */}
          {type === "experience" && (
            <div className="flex flex-col gap-3">
              {[
                { key: "role" as const, label: "Role", placeholder: "Software Engineer Intern" },
                { key: "company" as const, label: "Company", placeholder: "Ericsson" },
                { key: "location" as const, label: "Location", placeholder: "Ottawa, ON" },
                { key: "start_date" as const, label: "Start date", placeholder: "May 2024" },
                { key: "end_date" as const, label: "End date", placeholder: "Aug 2024" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">{label}</label>
                  <input type="text" value={exp[key]} onChange={(e) => sf_exp(key, e.target.value)}
                    placeholder={placeholder}
                    className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Responsibilities</label>
                <BulletListEditor items={exp.responsibilities}
                  onChange={(v) => setExp((d) => ({ ...d, responsibilities: v }))}
                  placeholder="What did you do?" />
              </div>
            </div>
          )}

          {/* Education fields */}
          {type === "education" && (
            <div className="flex flex-col gap-3">
              {[
                { key: "institution" as const, label: "Institution", placeholder: "University of Waterloo" },
                { key: "degree" as const, label: "Degree", placeholder: "Bachelor of Mathematics" },
                { key: "field" as const, label: "Field", placeholder: "Computer Science" },
                { key: "gpa" as const, label: "GPA", placeholder: "3.9 / 4.0" },
                { key: "start_date" as const, label: "Start date", placeholder: "Sep 2023" },
                { key: "end_date" as const, label: "End date", placeholder: "Apr 2027" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">{label}</label>
                  <input type="text" value={edu[key] || ""} onChange={(e) => sf_edu(key, e.target.value)}
                    placeholder={placeholder}
                    className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Details</label>
                <BulletListEditor items={edu.details}
                  onChange={(v) => setEdu((d) => ({ ...d, details: v }))}
                  placeholder="Notable course or achievement" />
              </div>
            </div>
          )}

          {/* Project fields */}
          {type === "project" && (
            <div className="flex flex-col gap-3">
              {[
                { key: "name" as const, label: "Project name", placeholder: "JobScout" },
                { key: "start_date" as const, label: "Start date", placeholder: "Jan 2025" },
                { key: "end_date" as const, label: "End date", placeholder: "Present" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-500">{label}</label>
                  <input type="text" value={proj[key]} onChange={(e) => sf_proj(key, e.target.value)}
                    placeholder={placeholder}
                    className="text-sm border border-zinc-200 rounded-md px-3 py-1.5 outline-none focus:border-zinc-400 transition-colors" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Description</label>
                <BulletListEditor items={proj.description}
                  onChange={(v) => setProj((d) => ({ ...d, description: v }))}
                  placeholder="What does it do?" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Tech stack</label>
                <TagEditor tags={proj.tech_stack}
                  onChange={(v) => setProj((d) => ({ ...d, tech_stack: v }))}
                  placeholder="React, Python... (Enter)" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-zinc-500">Links</label>
                <TagEditor tags={proj.links}
                  onChange={(v) => setProj((d) => ({ ...d, links: v }))}
                  placeholder="https://github.com/... (Enter)" />
              </div>
            </div>
          )}

          <button onClick={handleAdd} disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 text-sm font-semibold bg-zinc-900 text-white py-2.5 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add {type}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function CareerTwinInfoPage() {
  const [data, setData] = useState<InfoData>({ experience: [], education: [], projects: [], skills: "" });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");

  const fetchInfo = async () => {
    try {
      const res = await fetch(`${API}/careertwin/get_info`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      setError("Failed to load information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfo(); }, []);

  const handleUpdate = async (section: string, id: string, updateData: object) => {
    await fetch(`${API}/careertwin/update_info`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ section, id, data: updateData }] }),
    });
    await fetchInfo();
  };

  const handleDelete = async (section: string, id: string) => {
    await fetch(`${API}/careertwin/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ section, id }),
    });
    await fetchInfo();
  };

  const handleAdd = async (section: string, addData: object) => {
    await fetch(`${API}/careertwin/add_info`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ adds: [{ section, data: addData }] }),
    });
    await fetchInfo();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Information</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Your experiences, education, and projects. Click any entry to edit.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-700 transition-colors"
        >
          <Plus size={13} /> Add entry
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-5">{error}</p>
      )}

      {/* Experience */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={15} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Experience</h2>
          <span className="text-xs text-zinc-400">({data.experience.length})</span>
        </div>
        {data.experience.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No experience added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.experience.map((exp) => (
              <ExperienceCard
                key={exp.id}
                exp={exp}
                onUpdate={(id, d) => handleUpdate("experiences", id, d)}
                onDelete={(id) => handleDelete("experiences", id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Education */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={15} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Education</h2>
          <span className="text-xs text-zinc-400">({data.education.length})</span>
        </div>
        {data.education.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No education added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.education.map((edu) => (
              <EducationCard
                key={edu.id}
                edu={edu}
                onUpdate={(id, d) => handleUpdate("education", id, d)}
                onDelete={(id) => handleDelete("education", id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Projects */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Folder size={15} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900">Projects</h2>
          <span className="text-xs text-zinc-400">({data.projects.length})</span>
        </div>
        {data.projects.length === 0 ? (
          <p className="text-sm text-zinc-400 italic">No projects added yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.projects.map((proj) => (
              <ProjectCard
                key={proj.id}
                proj={proj}
                onUpdate={(id, d) => handleUpdate("projects", id, d)}
                onDelete={(id) => handleDelete("projects", id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Skills */}
      {data.skills && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Skills</h2>
          <div className="bg-white border border-zinc-100 rounded-lg px-5 py-4">
            <p className="text-sm text-zinc-600 leading-relaxed">{data.skills}</p>
          </div>
        </section>
      )}

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />}
    </div>
  );
}