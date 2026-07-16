/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Save, Loader2, RefreshCw, Plus, Trash2, GripVertical, User, ChevronDown, ChevronUp,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
function tok() { return localStorage.getItem("token") || ""; }

// ─── Types ────────────────────────────────────────────────────────────────────

interface StampedField { id: string; value: string; }
interface StampedBullet { id: string; value: string; }

interface StampedExperience {
  id: string;
  title: StampedField;
  company: StampedField;
  date: StampedField;
  bullets: StampedBullet[];
}

interface StampedProject {
  id: string;
  name: StampedField;
  date: StampedField;
  bullets: StampedBullet[];
}

interface StampedEducation {
  id: string;
  school: StampedField;
  degree: StampedField;
  date: StampedField;
}

interface Contact {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  linkedin_url: string;
  github: string;
  github_url: string;
  portfolio: string;
  portfolio_url: string;
}

interface SectionTitles {
  education: string;
  experience: string;
  skills: string;
  projects: string;
}

interface CvJson {
  contact: Contact;
  section_titles: SectionTitles;
  experiences: StampedExperience[];
  projects: StampedProject[];
  education: StampedEducation[];
  skills: string;
}

// ─── Drag state ───────────────────────────────────────────────────────────────

interface DragState {
  section: "experiences" | "projects" | "education";
  entryId: string;
  bulletIdx?: number;
}

// ─── Inline editable span ─────────────────────────────────────────────────────

function EditableSpan({
  value, onChange, placeholder, className = "", multiline = false,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string; multiline?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (ref.current && !focused) ref.current.textContent = value;
  }, [value, focused]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { setFocused(false); onChange(e.currentTarget.textContent || ""); }}
      onKeyDown={(e) => { if (!multiline && e.key === "Enter") { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
      className={`outline-none focus:bg-blue-50 focus:ring-1 focus:ring-blue-300 rounded px-0.5 min-w-[40px] inline-block empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-300 ${className}`}
    />
  );
}

// ─── Section header with editable title ───────────────────────────────────────

function SectionHeader({
  titleKey, titles, onTitleChange, collapsed, onToggle,
}: {
  titleKey: keyof SectionTitles;
  titles: SectionTitles;
  onTitleChange: (key: keyof SectionTitles, v: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex-1 flex items-center gap-2 border-b-2 border-zinc-900 pb-1">
        <EditableSpan
          value={titles[titleKey]}
          onChange={(v) => onTitleChange(titleKey, v)}
          placeholder="Section title"
          className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest"
        />
        <span className="text-[9px] text-zinc-300 italic">(editable)</span>
      </div>
      <button onClick={onToggle} className="p-1 hover:bg-zinc-100 rounded transition-colors">
        {collapsed ? <ChevronDown size={14} className="text-zinc-400" /> : <ChevronUp size={14} className="text-zinc-400" />}
      </button>
    </div>
  );
}

// ─── CV Editor Modal ──────────────────────────────────────────────────────────

export function CvEditorModal({
  userJobId, initialCvJson, onClose, onSaved,
}: {
  userJobId: string;
  initialCvJson: CvJson;
  onClose: () => void;
  onSaved: (newCvJson: CvJson, pdfUrl: string) => void;
}) {
  const [cv, setCv] = useState<CvJson>(JSON.parse(JSON.stringify(initialCvJson)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState<{ section: string; entryId?: string; bulletIdx?: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  function toggleCollapse(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  // ── contact ───────────────────────────────────────────────────────────────

  function updateContact(patch: Partial<Contact>) {
    setCv((c) => ({ ...c, contact: { ...c.contact, ...patch } }));
  }

  // ── section titles ────────────────────────────────────────────────────────

  function updateSectionTitle(key: keyof SectionTitles, value: string) {
    setCv((c) => ({ ...c, section_titles: { ...c.section_titles, [key]: value } }));
  }

  // ── experiences ───────────────────────────────────────────────────────────

  function updateExp(id: string, patch: Partial<StampedExperience>) {
    setCv((c) => ({ ...c, experiences: c.experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  function removeExp(id: string) {
    setCv((c) => ({ ...c, experiences: c.experiences.filter((e) => e.id !== id) }));
  }
  function addExp() {
    const eid = `new-${Date.now()}`;
    setCv((c) => ({
      ...c,
      experiences: [...c.experiences, {
        id: eid,
        title:   { id: `experience-${eid}-title`,   value: "" },
        company: { id: `experience-${eid}-company`, value: "" },
        date:    { id: `experience-${eid}-date`,    value: "" },
        bullets: [],
      }],
    }));
  }
  function addBulletToExp(expId: string) {
    setCv((c) => ({
      ...c,
      experiences: c.experiences.map((e) =>
        e.id === expId ? { ...e, bullets: [...e.bullets, { id: `new-${Date.now()}`, value: "" }] } : e
      ),
    }));
  }
  function removeBulletFromExp(expId: string, bi: number) {
    setCv((c) => ({
      ...c,
      experiences: c.experiences.map((e) =>
        e.id === expId ? { ...e, bullets: e.bullets.filter((_, i) => i !== bi) } : e
      ),
    }));
  }
  function updateExpBullet(expId: string, bi: number, value: string) {
    setCv((c) => ({
      ...c,
      experiences: c.experiences.map((e) =>
        e.id === expId ? { ...e, bullets: e.bullets.map((b, i) => (i === bi ? { ...b, value } : b)) } : e
      ),
    }));
  }

  // ── projects ──────────────────────────────────────────────────────────────

  function updateProj(id: string, patch: Partial<StampedProject>) {
    setCv((c) => ({ ...c, projects: c.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }
  function removeProj(id: string) {
    setCv((c) => ({ ...c, projects: c.projects.filter((p) => p.id !== id) }));
  }
  function addProj() {
    const pid = `new-${Date.now()}`;
    setCv((c) => ({
      ...c,
      projects: [...c.projects, {
        id: pid,
        name:    { id: `proj-${pid}-name`, value: "" },
        date:    { id: `proj-${pid}-date`, value: "" },
        bullets: [],
      }],
    }));
  }
  function addBulletToProj(projId: string) {
    setCv((c) => ({
      ...c,
      projects: c.projects.map((p) =>
        p.id === projId ? { ...p, bullets: [...p.bullets, { id: `new-${Date.now()}`, value: "" }] } : p
      ),
    }));
  }
  function removeBulletFromProj(projId: string, bi: number) {
    setCv((c) => ({
      ...c,
      projects: c.projects.map((p) =>
        p.id === projId ? { ...p, bullets: p.bullets.filter((_, i) => i !== bi) } : p
      ),
    }));
  }
  function updateProjBullet(projId: string, bi: number, value: string) {
    setCv((c) => ({
      ...c,
      projects: c.projects.map((p) =>
        p.id === projId ? { ...p, bullets: p.bullets.map((b, i) => (i === bi ? { ...b, value } : b)) } : p
      ),
    }));
  }

  // ── education ─────────────────────────────────────────────────────────────

  function updateEdu(id: string, patch: Partial<StampedEducation>) {
    setCv((c) => ({ ...c, education: c.education.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  }
  function removeEdu(id: string) {
    setCv((c) => ({ ...c, education: c.education.filter((e) => e.id !== id) }));
  }
  function addEdu() {
    const edid = `new-${Date.now()}`;
    setCv((c) => ({
      ...c,
      education: [...c.education, {
        id: edid,
        school: { id: `educ-${edid}-school`, value: "" },
        degree: { id: `educ-${edid}-degree`, value: "" },
        date:   { id: `educ-${edid}-date`,   value: "" },
      }],
    }));
  }

  // ── drag: entries ─────────────────────────────────────────────────────────

  function handleEntryDrop(section: DragState["section"], targetId: string) {
    if (!drag || drag.section !== section || drag.entryId === targetId) { setDrag(null); return; }
    setCv((c) => {
      const arr = [...(c[section] as any[])];
      const fromIdx = arr.findIndex((x: any) => x.id === drag.entryId);
      const toIdx   = arr.findIndex((x: any) => x.id === targetId);
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...c, [section]: arr };
    });
    setDrag(null); setDragOver(null);
  }

  // ── drag: bullets ─────────────────────────────────────────────────────────

  function handleBulletDrop(section: "experiences" | "projects", entryId: string, targetIdx: number) {
    if (!drag || drag.entryId !== entryId || drag.bulletIdx === undefined) { setDrag(null); return; }
    const fromIdx = drag.bulletIdx;
    if (fromIdx === targetIdx) { setDrag(null); return; }
    setCv((c) => {
      if (section === "experiences") {
        return {
          ...c, experiences: c.experiences.map((e) => {
            if (e.id !== entryId) return e;
            const bullets = [...e.bullets];
            const [moved] = bullets.splice(fromIdx, 1);
            bullets.splice(targetIdx, 0, moved);
            return { ...e, bullets };
          }),
        };
      } else {
        return {
          ...c, projects: c.projects.map((p) => {
            if (p.id !== entryId) return p;
            const bullets = [...p.bullets];
            const [moved] = bullets.splice(fromIdx, 1);
            bullets.splice(targetIdx, 0, moved);
            return { ...p, bullets };
          }),
        };
      }
    });
    setDrag(null); setDragOver(null);
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/custom_cv/edit?user_job_id=${userJobId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify(cv),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Save failed"); }
      const data = await res.json();
      onSaved(data.cv_text, data.cv_pdf_url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cv]);

  // ── bullet list renderer (shared) ─────────────────────────────────────────

  function BulletList({
    section, entryId, bullets, onAdd, onRemove, onUpdate,
  }: {
    section: "experiences" | "projects";
    entryId: string;
    bullets: StampedBullet[];
    onAdd: () => void;
    onRemove: (i: number) => void;
    onUpdate: (i: number, v: string) => void;
  }) {
    return (
      <div className="space-y-1.5 pl-5">
        {bullets.map((b, bi) => (
          <div
            key={b.id}
            draggable
            onDragStart={(e) => { e.stopPropagation(); setDrag({ section, entryId, bulletIdx: bi }); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver({ section, entryId, bulletIdx: bi }); }}
            onDrop={(e) => { e.stopPropagation(); handleBulletDrop(section, entryId, bi); }}
            onDragEnd={() => { setDrag(null); setDragOver(null); }}
            className={`flex items-start gap-2 group rounded-lg px-2 py-1 transition-all ${
              dragOver?.entryId === entryId && dragOver?.bulletIdx === bi ? "bg-blue-50 ring-1 ring-blue-200" : "hover:bg-zinc-50"
            }`}
          >
            <GripVertical size={12} className="text-zinc-200 group-hover:text-zinc-400 mt-1 shrink-0 cursor-grab active:cursor-grabbing" />
            <span className="text-zinc-300 mt-1 text-xs shrink-0">•</span>
            <EditableSpan
              value={b.value}
              onChange={(v) => onUpdate(bi, v)}
              placeholder="Bullet point"
              className="text-xs text-zinc-700 flex-1 leading-relaxed"
              multiline
            />
            <button
              onClick={() => onRemove(bi)}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-zinc-300 transition-all shrink-0 mt-0.5"
            >
              <X size={11} />
            </button>
          </div>
        ))}
        <button onClick={onAdd} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-700 transition-colors mt-1">
          <Plus size={11} /> Add bullet
        </button>
      </div>
    );
  }

  // ── render ────────────────────────────────────────────────────────────────

  const contact = cv.contact ?? {};
  const titles = cv.section_titles ?? { education: "Education", experience: "Experience", skills: "Skills", projects: "Projects" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Edit CV</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Click any field to edit · Drag to reorder · Cmd+S to save</p>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>}
            <button
              onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? "Compiling PDF…" : "Save & compile"}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
              <X size={16} className="text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-8">

          {/* Contact */}
          <section>
            <div className="flex items-center gap-2 mb-3 border-b-2 border-zinc-900 pb-1">
              <User size={12} className="text-zinc-900" />
              <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest">Contact</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Name",      key: "name"      as keyof Contact },
                { label: "Email",     key: "email"     as keyof Contact },
                { label: "Phone",     key: "phone"     as keyof Contact },
                { label: "LinkedIn",  key: "linkedin"  as keyof Contact },
                { label: "GitHub",    key: "github"    as keyof Contact },
                { label: "Portfolio", key: "portfolio" as keyof Contact },
              ].map(({ label, key }) => (
                <div key={key} className="border border-zinc-100 rounded-lg px-3 py-2">
                  <p className="text-[9px] text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
                  <EditableSpan
                    value={contact[key] ?? ""}
                    onChange={(v) => updateContact({ [key]: v })}
                    placeholder={label}
                    className="text-xs text-zinc-800 w-full block"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Education */}
          <section>
            <SectionHeader titleKey="education" titles={titles} onTitleChange={updateSectionTitle} collapsed={!!collapsed["education"]} onToggle={() => toggleCollapse("education")} />
            {!collapsed["education"] && (
              <div className="space-y-3">
                {cv.education.map((edu) => (
                  <div
                    key={edu.id}
                    draggable
                    onDragStart={() => setDrag({ section: "education", entryId: edu.id })}
                    onDragOver={(e) => { e.preventDefault(); setDragOver({ section: "education", entryId: edu.id }); }}
                    onDrop={() => handleEntryDrop("education", edu.id)}
                    onDragEnd={() => { setDrag(null); setDragOver(null); }}
                    className={`border rounded-xl p-4 space-y-2 transition-all ${dragOver?.section === "education" && dragOver?.entryId === edu.id ? "border-blue-300 bg-blue-50" : "border-zinc-100"}`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-zinc-300 mt-0.5 shrink-0 cursor-grab" />
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <EditableSpan value={edu.school.value} onChange={(v) => updateEdu(edu.id, { school: { ...edu.school, value: v } })} placeholder="School" className="text-sm font-semibold text-zinc-900 flex-1" />
                          <EditableSpan value={edu.date.value} onChange={(v) => updateEdu(edu.id, { date: { ...edu.date, value: v } })} placeholder="Date" className="text-xs text-zinc-400" />
                        </div>
                        <EditableSpan value={edu.degree.value} onChange={(v) => updateEdu(edu.id, { degree: { ...edu.degree, value: v } })} placeholder="Degree" className="text-xs text-zinc-600" />
                      </div>
                      <button onClick={() => removeEdu(edu.id)} className="p-1 hover:bg-red-50 rounded text-zinc-300 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={addEdu} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 border border-dashed border-zinc-200 hover:border-zinc-400 rounded-xl px-4 py-2.5 w-full transition-colors">
                  <Plus size={13} /> Add education
                </button>
              </div>
            )}
          </section>

          {/* Experience */}
          <section>
            <SectionHeader titleKey="experience" titles={titles} onTitleChange={updateSectionTitle} collapsed={!!collapsed["experience"]} onToggle={() => toggleCollapse("experience")} />
            {!collapsed["experience"] && (
              <div className="space-y-4">
                {cv.experiences.map((exp) => (
                  <div
                    key={exp.id}
                    draggable
                    onDragStart={() => setDrag({ section: "experiences", entryId: exp.id })}
                    onDragOver={(e) => { e.preventDefault(); setDragOver({ section: "experiences", entryId: exp.id }); }}
                    onDrop={() => handleEntryDrop("experiences", exp.id)}
                    onDragEnd={() => { setDrag(null); setDragOver(null); }}
                    className={`border rounded-xl p-4 space-y-3 transition-all ${dragOver?.section === "experiences" && dragOver?.entryId === exp.id ? "border-blue-300 bg-blue-50" : "border-zinc-100"}`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-zinc-300 mt-0.5 shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <EditableSpan value={exp.company.value} onChange={(v) => updateExp(exp.id, { company: { ...exp.company, value: v } })} placeholder="Company" className="text-sm font-semibold text-zinc-900 flex-1" />
                          <EditableSpan value={exp.date.value} onChange={(v) => updateExp(exp.id, { date: { ...exp.date, value: v } })} placeholder="Date" className="text-xs text-zinc-400" />
                        </div>
                        <EditableSpan value={exp.title.value} onChange={(v) => updateExp(exp.id, { title: { ...exp.title, value: v } })} placeholder="Title" className="text-xs text-zinc-500 italic" />
                      </div>
                      <button onClick={() => removeExp(exp.id)} className="p-1 hover:bg-red-50 rounded text-zinc-300 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <BulletList
                      section="experiences" entryId={exp.id} bullets={exp.bullets}
                      onAdd={() => addBulletToExp(exp.id)}
                      onRemove={(i) => removeBulletFromExp(exp.id, i)}
                      onUpdate={(i, v) => updateExpBullet(exp.id, i, v)}
                    />
                  </div>
                ))}
                <button onClick={addExp} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 border border-dashed border-zinc-200 hover:border-zinc-400 rounded-xl px-4 py-2.5 w-full transition-colors">
                  <Plus size={13} /> Add experience
                </button>
              </div>
            )}
          </section>

          {/* Skills */}
          <section>
            <SectionHeader titleKey="skills" titles={titles} onTitleChange={updateSectionTitle} collapsed={!!collapsed["skills"]} onToggle={() => toggleCollapse("skills")} />
            {!collapsed["skills"] && (
              <div className="border border-zinc-100 rounded-xl p-4">
                <EditableSpan
                  value={typeof cv.skills === "string" ? cv.skills : ""}
                  onChange={(v) => setCv((c) => ({ ...c, skills: v }))}
                  placeholder="e.g. Python, TypeScript, React, FastAPI…"
                  className="text-xs text-zinc-700 w-full block leading-relaxed"
                  multiline
                />
              </div>
            )}
          </section>

          {/* Projects */}
          <section>
            <SectionHeader titleKey="projects" titles={titles} onTitleChange={updateSectionTitle} collapsed={!!collapsed["projects"]} onToggle={() => toggleCollapse("projects")} />
            {!collapsed["projects"] && (
              <div className="space-y-4">
                {cv.projects.map((proj) => (
                  <div
                    key={proj.id}
                    draggable
                    onDragStart={() => setDrag({ section: "projects", entryId: proj.id })}
                    onDragOver={(e) => { e.preventDefault(); setDragOver({ section: "projects", entryId: proj.id }); }}
                    onDrop={() => handleEntryDrop("projects", proj.id)}
                    onDragEnd={() => { setDrag(null); setDragOver(null); }}
                    className={`border rounded-xl p-4 space-y-3 transition-all ${dragOver?.section === "projects" && dragOver?.entryId === proj.id ? "border-blue-300 bg-blue-50" : "border-zinc-100"}`}
                  >
                    <div className="flex items-start gap-2">
                      <GripVertical size={14} className="text-zinc-300 mt-0.5 shrink-0 cursor-grab active:cursor-grabbing" />
                      <div className="flex-1 flex items-center gap-2">
                        <EditableSpan value={proj.name.value} onChange={(v) => updateProj(proj.id, { name: { ...proj.name, value: v } })} placeholder="Project name" className="text-sm font-semibold text-zinc-900 flex-1" />
                        <EditableSpan value={proj.date.value} onChange={(v) => updateProj(proj.id, { date: { ...proj.date, value: v } })} placeholder="Date" className="text-xs text-zinc-400" />
                      </div>
                      <button onClick={() => removeProj(proj.id)} className="p-1 hover:bg-red-50 rounded text-zinc-300 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <BulletList
                      section="projects" entryId={proj.id} bullets={proj.bullets}
                      onAdd={() => addBulletToProj(proj.id)}
                      onRemove={(i) => removeBulletFromProj(proj.id, i)}
                      onUpdate={(i, v) => updateProjBullet(proj.id, i, v)}
                    />
                  </div>
                ))}
                <button onClick={addProj} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 border border-dashed border-zinc-200 hover:border-zinc-400 rounded-xl px-4 py-2.5 w-full transition-colors">
                  <Plus size={13} /> Add project
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Cover Letter Editor Modal ────────────────────────────────────────────────

const CL_PAGE_W = 794;
const CL_PAGE_H = 1123;

export function ClEditorModal({
  userJobId, initialHtml, onClose, onSaved,
}: {
  userJobId: string;
  initialHtml: string;
  onClose: () => void;
  onSaved: (pdfUrl: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState("");
  const [wordCount, setWordCount] = useState(0);

  const recomputeScale = useCallback(() => {
    if (!canvasRef.current) return;
    const available = canvasRef.current.clientWidth - 48;
    setScale(Math.min(1, available / CL_PAGE_W));
  }, []);

  useEffect(() => {
    recomputeScale();
    const ro = new ResizeObserver(recomputeScale);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [recomputeScale]);

  const writeToIframe = useCallback((html: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    if (!doc.body) return;
    doc.body.setAttribute("contenteditable", "true");
    doc.body.setAttribute("spellcheck", "true");
    doc.body.style.outline = "none";
    doc.body.style.cursor = "text";
    const text = doc.body.innerText || "";
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
    setIsDirty(false);
    doc.body.addEventListener("input", () => {
      setIsDirty(true);
      setWordCount((doc.body.innerText || "").trim().split(/\s+/).filter(Boolean).length);
    });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => writeToIframe(initialHtml), 50);
    return () => clearTimeout(t);
  }, [initialHtml, writeToIframe]);

  function getCurrentHtml() {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument ?? iframe?.contentWindow?.document;
    return doc?.documentElement?.outerHTML ?? "";
  }

  async function handleSave() {
    const html = getCurrentHtml();
    if (!html.trim()) { setError("Document is empty"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/custom_cl/edit?user_job_id=${userJobId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_job_id: userJobId, mode: "html", content: html }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail || "Save failed"); }
      const data = await res.json();
      onSaved(data.coverletter_url ?? "");
      setIsDirty(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true); setError("");
    try {
      const res = await fetch(`${API}/custom_cl/edit?user_job_id=${userJobId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_job_id: userJobId, mode: "regenerate" }),
      });
      if (!res.ok) throw new Error("Regeneration failed");
      const getRes = await fetch(`${API}/custom_cl/get?user_job_id=${userJobId}`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      if (getRes.ok) { const data = await getRes.json(); writeToIframe(data.html_data); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.key === "Escape" && !isDirty) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty]);

  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0 flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Edit Cover Letter</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {wordCount} words · ~{readingTime} min read
              {wordCount > 400 && <span className="text-red-400 ml-1">· Too long</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>}
            <button onClick={handleRegenerate} disabled={saving || regenerating}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-zinc-200 text-zinc-600 rounded-lg hover:border-zinc-400 transition-colors disabled:opacity-40">
              {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerate
            </button>
            <button onClick={handleSave} disabled={saving || regenerating}
              className="relative flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? "Saving…" : "Save"}
              {isDirty && !saving && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
            </button>
            <button onClick={() => { if (isDirty && !window.confirm("Discard unsaved changes?")) return; onClose(); }}
              className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
              <X size={16} className="text-zinc-500" />
            </button>
          </div>
        </div>
        <div ref={canvasRef} className="flex-1 bg-zinc-100 overflow-auto flex justify-center py-8 px-4">
          <div style={{ width: CL_PAGE_W, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "top center" }}>
            <iframe ref={iframeRef} title="cover-letter-editor"
              style={{ width: CL_PAGE_W, height: CL_PAGE_H, border: "none", display: "block", boxShadow: "0 4px 32px rgba(0,0,0,0.14)", background: "white", borderRadius: 2 }} />
          </div>
        </div>
        <p className="shrink-0 text-[11px] text-zinc-400 text-center py-2">
          Click anywhere in the document to edit · Cmd+S to save
        </p>
      </div>
    </div>
  );
}
