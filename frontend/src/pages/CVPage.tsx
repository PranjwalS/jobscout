import { useState, useRef } from "react";
import { Upload, FileText, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  gpa: string | null;
  start_date: string;
  end_date: string;
  details: string[];
};

type ExperienceEntry = {
  id: string;
  company: string;
  role: string;
  location: string;
  start_date: string;
  end_date: string;
  responsibilities: string[];
};

type ProjectEntry = {
  id: string;
  name: string;
  description: string[];
  start_date: string;
  end_date: string;
  links: string[];
  tech_stack: string[];
};

type CVData = {
  education: EducationEntry[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  skills: string;
};

function SectionCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-zinc-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 transition-colors"
      >
        {title}
        {open ? <ChevronUp size={15} className="text-zinc-400" /> : <ChevronDown size={15} className="text-zinc-400" />}
      </button>
      {open && <div className="px-5 pb-5 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors"
      />
    </div>
  );
}

function EntryCard({
  children,
  onSave,
  onCancel,
  dirty,
}: {
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  dirty: boolean;
}) {
  return (
    <div className="border border-zinc-100 rounded-md p-4 flex flex-col gap-3 relative">
      {children}
      {dirty && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-3 py-1.5 rounded-md hover:bg-zinc-700 transition-colors"
          >
            <Check size={12} /> Save
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-400 transition-colors"
          >
            <X size={12} /> Discard
          </button>
        </div>
      )}
    </div>
  );
}

export default function CVPage() {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [dirtyEntries, setDirtyEntries] = useState<Record<string, boolean>>({});
  const [originals, setOriginals] = useState<Record<string, unknown>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem("token");

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API}/cv/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const d = await res.json();
        setUploadError(d.detail || "Upload failed");
        return;
      }
      await loadCV();
    } catch {
      setUploadError("Network error");
    } finally {
      setUploading(false);
    }
  };

  const loadCV = async () => {
    const res = await fetch(`${API}/cv/get`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setCvData(data);
      const origs: Record<string, unknown> = {};
      [...(data.education || []), ...(data.experience || []), ...(data.projects || [])].forEach(
        (e: { id: string }) => { origs[e.id] = JSON.parse(JSON.stringify(e)); }
      );
      setOriginals(origs);
    }
  };

  const markDirty = (id: string) => setDirtyEntries((p) => ({ ...p, [id]: true }));

  const handleSave = async (section: string, entry: { id: string }) => {
    setSaving(entry.id);
    try {
      await fetch(`${API}/cv/update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [{ section, id: entry.id, data: entry }],
        }),
      });
      setDirtyEntries((p) => { const n = { ...p }; delete n[entry.id]; return n; });
      setOriginals((p) => ({ ...p, [entry.id]: JSON.parse(JSON.stringify(entry)) }));
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = (id: string) => {
    const orig = originals[id];
    if (!orig || !cvData) return;
    setCvData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        education: prev.education.map((e) => (e.id === id ? (orig as EducationEntry) : e)),
        experience: prev.experience.map((e) => (e.id === id ? (orig as ExperienceEntry) : e)),
        projects: prev.projects.map((e) => (e.id === id ? (orig as ProjectEntry) : e)),
      };
    });
    setDirtyEntries((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  const updateEdu = (id: string, field: keyof EducationEntry, val: string) => {
    setCvData((p) =>
      p ? { ...p, education: p.education.map((e) => (e.id === id ? { ...e, [field]: val } : e)) } : p
    );
    markDirty(id);
  };

  const updateExp = (id: string, field: keyof ExperienceEntry, val: string) => {
    setCvData((p) =>
      p ? { ...p, experience: p.experience.map((e) => (e.id === id ? { ...e, [field]: val } : e)) } : p
    );
    markDirty(id);
  };

  const updateProj = (id: string, field: keyof ProjectEntry, val: string) => {
    setCvData((p) =>
      p ? { ...p, projects: p.projects.map((e) => (e.id === id ? { ...e, [field]: val } : e)) } : p
    );
    markDirty(id);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">

      <div>
        <h1 className="text-xl font-bold text-zinc-900">Your CV</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Upload your CV to populate your profile. Edit any section below.</p>
      </div>

      {/* Upload zone */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleUpload(f);
        }}
        className="border-2 border-dashed border-zinc-200 rounded-lg p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-all"
      >
        {uploading ? (
          <Loader2 size={24} className="text-zinc-400 animate-spin" />
        ) : (
          <Upload size={24} className="text-zinc-400" />
        )}
        <div className="text-center">
          <p className="text-sm font-semibold text-zinc-700">
            {uploading ? "Parsing your CV..." : cvData ? "Re-upload to update" : "Upload your CV"}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">PDF only — drag & drop or click</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </div>

      {uploadError && (
        <p className="text-red-500 text-xs font-medium bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {uploadError}
        </p>
      )}

      {!cvData && !uploading && (
        <button
          onClick={loadCV}
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 transition-colors self-start"
        >
          <FileText size={14} /> Load existing CV data
        </button>
      )}

      {cvData && (
        <div className="flex flex-col gap-4">

          {/* Education */}
          <SectionCard title={`Education (${cvData.education.length})`}>
            {cvData.education.map((e) => (
              <EntryCard
                key={e.id}
                dirty={!!dirtyEntries[e.id]}
                onSave={() => handleSave("education", e)}
                onCancel={() => handleCancel(e.id)}
              >
                {saving === e.id && <Loader2 size={14} className="animate-spin text-zinc-400 absolute top-3 right-3" />}
                <div className="grid grid-cols-2 gap-3">
                  <EditableField label="Institution" value={e.institution} onChange={(v) => updateEdu(e.id, "institution", v)} />
                  <EditableField label="Degree" value={e.degree} onChange={(v) => updateEdu(e.id, "degree", v)} />
                  <EditableField label="Field" value={e.field} onChange={(v) => updateEdu(e.id, "field", v)} />
                  <EditableField label="GPA" value={e.gpa || ""} onChange={(v) => updateEdu(e.id, "gpa", v)} />
                  <EditableField label="Start date" value={e.start_date} onChange={(v) => updateEdu(e.id, "start_date", v)} />
                  <EditableField label="End date" value={e.end_date} onChange={(v) => updateEdu(e.id, "end_date", v)} />
                </div>
              </EntryCard>
            ))}
          </SectionCard>

          {/* Experience */}
          <SectionCard title={`Experience (${cvData.experience.length})`}>
            {cvData.experience.map((e) => (
              <EntryCard
                key={e.id}
                dirty={!!dirtyEntries[e.id]}
                onSave={() => handleSave("experiences", e)}
                onCancel={() => handleCancel(e.id)}
              >
                {saving === e.id && <Loader2 size={14} className="animate-spin text-zinc-400 absolute top-3 right-3" />}
                <div className="grid grid-cols-2 gap-3">
                  <EditableField label="Company" value={e.company} onChange={(v) => updateExp(e.id, "company", v)} />
                  <EditableField label="Role" value={e.role} onChange={(v) => updateExp(e.id, "role", v)} />
                  <EditableField label="Location" value={e.location} onChange={(v) => updateExp(e.id, "location", v)} />
                  <EditableField label="Start date" value={e.start_date} onChange={(v) => updateExp(e.id, "start_date", v)} />
                  <EditableField label="End date" value={e.end_date} onChange={(v) => updateExp(e.id, "end_date", v)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Responsibilities</label>
                  <textarea
                    value={e.responsibilities.join("\n")}
                    onChange={(ev) => {
                      setCvData((p) =>
                        p ? { ...p, experience: p.experience.map((x) => x.id === e.id ? { ...x, responsibilities: ev.target.value.split("\n") } : x) } : p
                      );
                      markDirty(e.id);
                    }}
                    rows={4}
                    className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors resize-none font-mono"
                  />
                  <p className="text-[10px] text-zinc-400">One bullet per line</p>
                </div>
              </EntryCard>
            ))}
          </SectionCard>

          {/* Projects */}
          <SectionCard title={`Projects (${cvData.projects.length})`}>
            {cvData.projects.map((e) => (
              <EntryCard
                key={e.id}
                dirty={!!dirtyEntries[e.id]}
                onSave={() => handleSave("projects", e)}
                onCancel={() => handleCancel(e.id)}
              >
                {saving === e.id && <Loader2 size={14} className="animate-spin text-zinc-400 absolute top-3 right-3" />}
                <div className="grid grid-cols-2 gap-3">
                  <EditableField label="Name" value={e.name} onChange={(v) => updateProj(e.id, "name", v)} />
                  <EditableField label="Start date" value={e.start_date} onChange={(v) => updateProj(e.id, "start_date", v)} />
                  <EditableField label="End date" value={e.end_date} onChange={(v) => updateProj(e.id, "end_date", v)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Description</label>
                  <textarea
                    value={e.description.join("\n")}
                    onChange={(ev) => {
                      setCvData((p) =>
                        p ? { ...p, projects: p.projects.map((x) => x.id === e.id ? { ...x, description: ev.target.value.split("\n") } : x) } : p
                      );
                      markDirty(e.id);
                    }}
                    rows={3}
                    className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors resize-none font-mono"
                  />
                </div>
                <EditableField label="Tech stack (comma separated)" value={e.tech_stack.join(", ")} onChange={(v) => {
                  setCvData((p) =>
                    p ? { ...p, projects: p.projects.map((x) => x.id === e.id ? { ...x, tech_stack: v.split(",").map((s) => s.trim()) } : x) } : p
                  );
                  markDirty(e.id);
                }} />
              </EntryCard>
            ))}
          </SectionCard>

          {/* Skills */}
          <SectionCard title="Skills">
            <div className="flex flex-col gap-1">
              <textarea
                value={cvData.skills || ""}
                onChange={(e) => setCvData((p) => p ? { ...p, skills: e.target.value } : p)}
                rows={3}
                placeholder="Your skills as parsed from CV..."
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:border-zinc-900 transition-colors resize-none"
              />
              <p className="text-[10px] text-zinc-400">Skills are managed separately and will be editable via your profile settings.</p>
            </div>
          </SectionCard>

        </div>
      )}
    </div>
  );
}