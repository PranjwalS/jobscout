import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, CheckCircle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

type ProfileData = {
  display_name: string;
  current_role: string;
  bio: string;
  phone: string;
  email: string;
  location: string;
  links: string[];
};

const EMPTY: ProfileData = {
  display_name: "",
  current_role: "",
  bio: "",
  phone: "",
  email: "",
  location: "",
  links: [],
};

export default function CareerTwinProfilePage() {
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [original, setOriginal] = useState<ProfileData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");

  const isDirty = JSON.stringify(form) !== JSON.stringify(original);

  useEffect(() => {
    fetch(`${API}/profile/get`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const parsed: ProfileData = {
          display_name: data.display_name || "",
          current_role: data.current_role || "",
          bio: data.bio || "",
          phone: data.phone || "",
          email: data.email || "",
          location: data.location || "",
          links: Array.isArray(data.links) ? data.links : [],
        };
        setForm(parsed);
        setOriginal(parsed);
      })
      .catch(() => setError("Failed to load profile"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/profile/update`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setOriginal(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError("Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: keyof ProfileData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addLink = () => setForm((prev) => ({ ...prev, links: [...prev.links, ""] }));
  const updateLink = (i: number, val: string) =>
    setForm((prev) => ({ ...prev, links: prev.links.map((l, idx) => idx === i ? val : l) }));
  const removeLink = (i: number) =>
    setForm((prev) => ({ ...prev, links: prev.links.filter((_, idx) => idx !== i) }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Profile</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Your identity on JobScout. This info is used in cover letters and your Career Twin.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 text-white px-4 py-2 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle size={13} /> : <Save size={13} />}
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      {error && (
        <p className="text-red-500 text-xs bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-5">{error}</p>
      )}

      <div className="flex flex-col gap-6">
        {/* Basic identity */}
        <section className="bg-white rounded-lg border border-zinc-100 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-900">Identity</h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Display name *</label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setField("display_name", e.target.value)}
              placeholder="Pranjwal Singh"
              className="text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Current role / title</label>
            <input
              type="text"
              value={form.current_role}
              onChange={(e) => setField("current_role", e.target.value)}
              placeholder="Software Engineering Intern"
              className="text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Bio</label>
            <textarea
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
              placeholder="A short bio about yourself..."
              rows={3}
              className="text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors resize-none"
            />
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white rounded-lg border border-zinc-100 p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-zinc-900">Contact</h2>
          <p className="text-xs text-zinc-400 -mt-2">
            These appear in your generated cover letters automatically.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="pranjwal@email.com"
                className="text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-500">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
                placeholder="+1 (514) 000-0000"
                className="text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setField("location", e.target.value)}
              placeholder="Waterloo, ON"
              className="text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors"
            />
          </div>
        </section>

        {/* Links */}
        <section className="bg-white rounded-lg border border-zinc-100 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Links</h2>
              <p className="text-xs text-zinc-400 mt-0.5">LinkedIn, GitHub, portfolio — appears in cover letter header</p>
            </div>
            <button
              onClick={addLink}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 px-2.5 py-1.5 rounded-md border border-zinc-200 hover:border-zinc-400 transition-colors"
            >
              <Plus size={12} /> Add link
            </button>
          </div>

          {form.links.length === 0 && (
            <p className="text-xs text-zinc-400 italic">No links added yet. Click "Add link" to add one.</p>
          )}

          <div className="flex flex-col gap-2">
            {form.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="url"
                  value={link}
                  onChange={(e) => updateLink(i, e.target.value)}
                  placeholder="https://github.com/yourname"
                  className="flex-1 text-sm border border-zinc-200 rounded-md px-3 py-2 outline-none focus:border-zinc-400 transition-colors"
                />
                <button
                  onClick={() => removeLink(i)}
                  className="p-2 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Save footer */}
        {isDirty && (
          <div className="flex items-center justify-between bg-zinc-900 text-white rounded-lg px-5 py-3.5">
            <p className="text-sm font-medium">You have unsaved changes</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white text-zinc-900 px-4 py-2 rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}