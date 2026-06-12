import { useOutletContext, useNavigate } from "react-router-dom";
import { Briefcase, Plus, Mail, User2, FileText, ArrowRight } from "lucide-react";

type User = { full_name: string; email: string };

export default function OverviewPage() {
  const { user } = useOutletContext<{ user: User }>();
  const navigate = useNavigate();

  const quickLinks = [
    { label: "Edit Profile", desc: "Update your name, bio, links", path: "/dashboard/careertwin/profile", icon: <User2 size={18} className="text-zinc-400" /> },
    { label: "My Information", desc: "Experiences, education, projects", path: "/dashboard/careertwin/info", icon: <FileText size={18} className="text-zinc-400" /> },
    { label: "Generate Cover Letter", desc: "Upload a job posting and get a letter", path: "/dashboard/products/coverletter", icon: <Mail size={18} className="text-zinc-400" /> },
    { label: "Upload CV", desc: "Parse and store your resume", path: "/dashboard/products/cv", icon: <Briefcase size={18} className="text-zinc-400" /> },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-zinc-900">
          Good morning, {user?.full_name?.split(" ")[0] || "there"} 👋
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">Here's your JobScout workspace.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Jobs tracked", value: "—", sub: "total" },
          { label: "Applications", value: "—", sub: "sent" },
          { label: "Cover letters", value: "—", sub: "generated" },
          { label: "Interviews", value: "—", sub: "scheduled" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-lg border border-zinc-100 px-5 py-4">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">{label}</p>
            <p className="text-2xl font-bold text-zinc-900">{value}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {quickLinks.map(({ label, desc, path, icon }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className="bg-white border border-zinc-100 rounded-lg px-5 py-4 flex items-center gap-4 hover:border-zinc-300 hover:shadow-sm transition-all text-left group"
          >
            <div className="w-9 h-9 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900">{label}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>
            </div>
            <ArrowRight size={15} className="text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
          </button>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-white rounded-lg border border-zinc-100 p-10 flex flex-col items-center justify-center text-center">
        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
          <Briefcase size={18} className="text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-1">Start your job search</h3>
        <p className="text-zinc-400 text-sm max-w-xs mb-4">
          Upload a job posting to generate a tailored cover letter instantly.
        </p>
        <button
          onClick={() => navigate("/dashboard/products/coverletter")}
          className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-md hover:bg-zinc-700 transition-colors"
        >
          <Plus size={14} /> Generate cover letter
        </button>
      </div>
    </div>
  );
}