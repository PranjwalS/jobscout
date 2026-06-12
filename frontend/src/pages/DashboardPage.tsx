// OBSOLETE REMOVE SOON

// import { useEffect, useState, useRef } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   LayoutDashboard, Briefcase, User2, Settings, LogOut,
//   ChevronDown, Bell, Plus, Search, ChevronRight,
//   FileText, Mail, PanelLeftClose, PanelLeftOpen,
// } from "lucide-react";
// import CVPage from "./CVPage";
// import CoverLetterPage from "./CoverLetterPage";

// const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// const SIDEBAR_OPEN = 256;   // px — w-64
// const SIDEBAR_CLOSED = 64;  // px — w-16

// type UserProfile = {
//   id: string;
//   email: string;
//   full_name: string;
//   slug: string | null;
//   display_name: string | null;
// };

// type NavItem = {
//   label: string;
//   icon: React.ReactNode;
//   children?: { label: string }[];
// };

// const navItems: NavItem[] = [
//   { label: "Overview",     icon: <LayoutDashboard size={16} /> },
//   {
//     label: "Dashboards",
//     icon: <Briefcase size={16} />,
//     children: [{ label: "Fall 2026 SWE" }, { label: "Summer 2027" }],
//   },
//   { label: "My CV",        icon: <FileText size={16} /> },
//   { label: "Cover Letter", icon: <Mail size={16} /> },
//   { label: "Career Twin",  icon: <User2 size={16} /> },
//   { label: "Settings",     icon: <Settings size={16} /> },
// ];

// function NavMenu({
//   item, active, onClick, collapsed,
// }: {
//   item: NavItem;
//   active: string;
//   onClick: (label: string) => void;
//   collapsed: boolean;
// }) {
//   const [open, setOpen] = useState(false);
//   const isActive = active === item.label;
//   const base = `w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors`;
//   const activeClass = "bg-zinc-100 text-zinc-900 font-medium";
//   const inactiveClass = "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900";

//   if (item.children) {
//     return (
//       <div>
//         <button
//           onClick={() => !collapsed && setOpen((v) => !v)}
//           title={collapsed ? item.label : undefined}
//           className={`${base} ${isActive ? activeClass : inactiveClass} ${collapsed ? "justify-center gap-0" : "justify-between gap-2"}`}
//         >
//           <div className="flex items-center gap-2.5">
//             <span className="text-zinc-400 shrink-0">{item.icon}</span>
//             {!collapsed && item.label}
//           </div>
//           {!collapsed && (
//             <ChevronDown size={14} className={`text-zinc-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
//           )}
//         </button>
//         {!collapsed && open && (
//           <ul className="ml-4 pl-3 border-l border-zinc-100 mt-1 flex flex-col gap-0.5">
//             {item.children.map((child) => (
//               <li key={child.label}>
//                 <button
//                   onClick={() => onClick(child.label)}
//                   className="w-full text-left text-sm text-zinc-500 hover:text-zinc-900 px-2 py-1.5 rounded-md hover:bg-zinc-50 transition-colors"
//                 >
//                   {child.label}
//                 </button>
//               </li>
//             ))}
//             <li>
//               <button className="w-full text-left text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1.5 flex items-center gap-1">
//                 <Plus size={12} /> New dashboard
//               </button>
//             </li>
//           </ul>
//         )}
//       </div>
//     );
//   }

//   return (
//     <button
//       onClick={() => onClick(item.label)}
//       title={collapsed ? item.label : undefined}
//       className={`${base} gap-2.5 ${isActive ? activeClass : inactiveClass} ${collapsed ? "justify-center" : ""}`}
//     >
//       <span className="text-zinc-400 shrink-0">{item.icon}</span>
//       {!collapsed && item.label}
//     </button>
//   );
// }

// export default function DashboardPage() {
//   const navigate = useNavigate();
//   const [user, setUser]                     = useState<UserProfile | null>(null);
//   const [loading, setLoading]               = useState(true);
//   const [activePage, setActivePage]         = useState("Overview");
//   const [profileOpen, setProfileOpen]       = useState(false);
//   const [collapsed, setCollapsed]           = useState(false);
//   const profileRef                          = useRef<HTMLDivElement>(null);

//   const sidebarW = collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN;

//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     if (!token) { navigate("/login"); return; }
//     fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((r) => { if (r.status === 401) { localStorage.removeItem("token"); navigate("/login"); return null; } return r.json(); })
//       .then((d) => { if (d) setUser(d); })
//       .catch(() => navigate("/login"))
//       .finally(() => setLoading(false));
//   }, [navigate]);

//   useEffect(() => {
//     const h = (e: MouseEvent) => {
//       if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
//     };
//     document.addEventListener("click", h);
//     return () => document.removeEventListener("click", h);
//   }, []);

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-white flex items-center justify-center">
//         <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
//       </div>
//     );
//   }

//   const initials = user?.full_name
//     ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
//     : "?";

//   return (
//     <div className="min-h-screen bg-zinc-50 font-['DM_Sans',sans-serif]">

//       {/* ── SIDEBAR (fixed) ─────────────────────────────────────────────── */}
//       <aside
//         className="fixed top-0 left-0 h-full bg-white border-r border-zinc-100 flex flex-col z-40 overflow-hidden transition-all duration-200"
//         style={{ width: sidebarW }}
//       >
//         {/* Logo + toggle */}
//         <div className="h-14 flex items-center justify-between px-3 border-b border-zinc-100 shrink-0 overflow-hidden">
//           {!collapsed && (
//             <span className="text-sm font-black tracking-widest uppercase text-zinc-900 pl-1 whitespace-nowrap">
//               JobScout
//             </span>
//           )}
//           <button
//             onClick={() => setCollapsed((v) => !v)}
//             className={`p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0 ${collapsed ? "mx-auto" : "ml-auto"}`}
//           >
//             {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
//           </button>
//         </div>

//         {/* Nav */}
//         <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 flex flex-col gap-1">
//           {navItems.map((item) => (
//             <NavMenu
//               key={item.label}
//               item={item}
//               active={activePage}
//               onClick={setActivePage}
//               collapsed={collapsed}
//             />
//           ))}
//         </nav>

//         {/* Profile */}
//         <div className="px-2 py-3 border-t border-zinc-100 shrink-0" ref={profileRef}>
//           <div className="relative">
//             <button
//               onClick={() => setProfileOpen((v) => !v)}
//               className={`w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-zinc-50 transition-colors ${collapsed ? "justify-center" : ""}`}
//             >
//               <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
//                 {initials}
//               </div>
//               {!collapsed && (
//                 <>
//                   <div className="flex-1 text-left min-w-0">
//                     <p className="text-xs font-semibold text-zinc-900 truncate">{user?.full_name || "User"}</p>
//                     <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
//                   </div>
//                   <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
//                 </>
//               )}
//             </button>
//             {profileOpen && (
//               <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-md border border-zinc-100 shadow-lg py-1 z-50">
//                 <div className="px-3 py-2 border-b border-zinc-50">
//                   <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
//                 </div>
//                 <button
//                   onClick={() => { localStorage.removeItem("token"); navigate("/login"); }}
//                   className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-red-600 transition-colors"
//                 >
//                   <LogOut size={14} /> Sign out
//                 </button>
//               </div>
//             )}
//           </div>
//         </div>
//       </aside>

//       {/* ── MAIN (margin pushes content clear of fixed sidebar) ─────────── */}
//       <div
//         className="flex flex-col min-h-screen transition-all duration-200"
//         style={{ marginLeft: sidebarW }}
//       >
//         {/* Header */}
//         <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
//           <div className="flex items-center gap-2 text-sm text-zinc-400 min-w-0">
//             <span className="shrink-0">JobScout</span>
//             <ChevronRight size={14} className="shrink-0" />
//             <span className="text-zinc-900 font-medium truncate">{activePage}</span>
//           </div>
//           <div className="flex items-center gap-2 shrink-0">
//             <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
//               <Search size={16} />
//             </button>
//             <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
//               <Bell size={16} />
//             </button>
//             <button className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-zinc-700 transition-colors whitespace-nowrap">
//               <Plus size={14} /> New dashboard
//             </button>
//           </div>
//         </header>

//         {/* Page content */}
//         <main className="flex-1 min-w-0 overflow-hidden">

//           {activePage === "Overview" && (
//             <div className="p-6 max-w-5xl">
//               <div className="mb-6">
//                 <h1 className="text-xl font-bold text-zinc-900">
//                   Good morning, {user?.full_name?.split(" ")[0] || "there"} 👋
//                 </h1>
//                 <p className="text-zinc-500 text-sm mt-0.5">Here's what's happening with your job search.</p>
//               </div>
//               <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
//                 {[
//                   { label: "Jobs matched",      value: "—", sub: "this week" },
//                   { label: "Applications sent", value: "—", sub: "total" },
//                   { label: "Cover letters",     value: "—", sub: "generated" },
//                   { label: "Dashboards",        value: "0", sub: "active" },
//                 ].map(({ label, value, sub }) => (
//                   <div key={label} className="bg-white rounded-lg border border-zinc-100 px-5 py-4">
//                     <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">{label}</p>
//                     <p className="text-2xl font-bold text-zinc-900">{value}</p>
//                     <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
//                   </div>
//                 ))}
//               </div>
//               <div className="bg-white rounded-lg border border-zinc-100 p-12 flex flex-col items-center justify-center text-center">
//                 <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
//                   <Briefcase size={18} className="text-zinc-400" />
//                 </div>
//                 <h3 className="text-sm font-semibold text-zinc-900 mb-1">No dashboards yet</h3>
//                 <p className="text-zinc-400 text-sm max-w-[30ch] mb-4">
//                   Create your first job search dashboard to start matching with roles.
//                 </p>
//                 <button className="flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2.5 rounded-md hover:bg-zinc-700 transition-colors">
//                   <Plus size={14} /> Create dashboard
//                 </button>
//               </div>
//             </div>
//           )}

//           {activePage === "My CV" && (
//             <div className="p-6 h-full">
//               <CVPage />
//             </div>
//           )}

//           {activePage === "Cover Letter" && (
//             <div className="p-6 flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
//               <CoverLetterPage />
//             </div>
//           )}

//           {!["Overview", "My CV", "Cover Letter"].includes(activePage) && (
//             <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
//               {activePage} — coming soon
//             </div>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }