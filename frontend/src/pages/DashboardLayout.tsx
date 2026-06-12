/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard, Briefcase, User2, LogOut,
  ChevronDown, Bell, Plus, Search, ChevronRight,
  FileText, Mail, PanelLeftClose, PanelLeftOpen,
  Package, BookOpen, Folder,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SIDEBAR_OPEN = 256;
const SIDEBAR_CLOSED = 64;

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
};

type NavGroup = {
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: { label: string; path: string; icon: React.ReactNode }[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: <LayoutDashboard size={16} />,
    path: "/dashboard/overview",
  },
  {
    label: "Dashboards",
    icon: <Briefcase size={16} />,
    children: [
      { label: "All Jobs", path: "/dashboard/jobs", icon: <Folder size={13} /> },
      { label: "New Dashboard", path: "/dashboard/new", icon: <Plus size={13} /> },
    ],
  },
  {
    label: "Career Twin",
    icon: <User2 size={16} />,
    children: [
      { label: "Profile", path: "/dashboard/careertwin/profile", icon: <User2 size={13} /> },
      { label: "Information", path: "/dashboard/careertwin/info", icon: <BookOpen size={13} /> },
    ],
  },
  {
    label: "Products",
    icon: <Package size={16} />,
    children: [
      { label: "My CV", path: "/dashboard/products/cv", icon: <FileText size={13} /> },
      { label: "Cover Letter", path: "/dashboard/products/coverletter", icon: <Mail size={13} /> },
    ],
  },
];

function SidebarGroup({
  group,
  collapsed,
  defaultOpen = false,
}: {
  group: NavGroup;
  collapsed: boolean;
  defaultOpen?: boolean;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(defaultOpen);

  // Auto-open if a child is active
  useEffect(() => {
    if (group.children?.some((c) => location.pathname.startsWith(c.path))) {
      setOpen(true);
    }
  }, [location.pathname]);

  const isActive = group.path
    ? location.pathname === group.path
    : group.children?.some((c) => location.pathname.startsWith(c.path));

  const baseBtn = `w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors`;
  const activeClass = "bg-zinc-100 text-zinc-900 font-medium";
  const inactiveClass = "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900";

  if (group.path) {
    return (
      <NavLink
        to={group.path}
        title={collapsed ? group.label : undefined}
        className={`${baseBtn} gap-2.5 ${isActive ? activeClass : inactiveClass} ${collapsed ? "justify-center" : ""}`}
      >
        <span className="shrink-0">{group.icon}</span>
        {!collapsed && group.label}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => !collapsed && setOpen((v) => !v)}
        title={collapsed ? group.label : undefined}
        className={`${baseBtn} ${isActive ? activeClass : inactiveClass} ${collapsed ? "justify-center gap-0" : "justify-between gap-2"}`}
      >
        <div className="flex items-center gap-2.5">
          <span className="shrink-0">{group.icon}</span>
          {!collapsed && group.label}
        </div>
        {!collapsed && (
          <ChevronDown
            size={13}
            className={`text-zinc-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {!collapsed && open && group.children && (
        <ul className="ml-4 pl-3 border-l border-zinc-100 mt-1 flex flex-col gap-0.5">
          {group.children.map((child) => {
            const childActive = location.pathname === child.path;
            return (
              <li key={child.path}>
                <NavLink
                  to={child.path}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors ${
                    childActive
                      ? "text-zinc-900 font-medium bg-zinc-50"
                      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  <span className="shrink-0 text-zinc-400">{child.icon}</span>
                  {child.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const sidebarW = collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        if (r.status === 401) { localStorage.removeItem("token"); navigate("/login"); return null; }
        return r.json();
      })
      .then((d) => { if (d) setUser(d); })
      .catch(() => navigate("/login"))
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    );
  }

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  // Derive breadcrumb label from current path
  const breadcrumb = (() => {
    const p = location.pathname;
    if (p.includes("overview")) return "Overview";
    if (p.includes("jobs")) return "All Jobs";
    if (p.includes("careertwin/profile")) return "Profile";
    if (p.includes("careertwin/info")) return "Information";
    if (p.includes("products/cv")) return "My CV";
    if (p.includes("products/coverletter")) return "Cover Letter";
    if (p.includes("new")) return "New Dashboard";
    return "Dashboard";
  })();

  return (
    <div className="min-h-screen bg-zinc-50 font-['DM_Sans',sans-serif]">

      {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
      <aside
        className="fixed top-0 left-0 h-full bg-white border-r border-zinc-100 flex flex-col z-40 overflow-hidden transition-all duration-200"
        style={{ width: sidebarW }}
      >
        {/* Logo + toggle */}
        <div className="h-14 flex items-center justify-between px-3 border-b border-zinc-100 shrink-0 overflow-hidden">
          {!collapsed && (
            <span className="text-sm font-black tracking-widest uppercase text-zinc-900 pl-1 whitespace-nowrap">
              JobScout
            </span>
          )}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors shrink-0 ${collapsed ? "mx-auto" : "ml-auto"}`}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 flex flex-col gap-1">
          {navGroups.map((group) => (
            <SidebarGroup
              key={group.label}
              group={group}
              collapsed={collapsed}
              defaultOpen={
                group.label === "Career Twin" ||
                group.label === "Products" ||
                group.label === "Dashboards"
              }
            />
          ))}
        </nav>

        {/* Profile footer */}
        <div className="px-2 py-3 border-t border-zinc-100 shrink-0" ref={profileRef}>
          <div className="relative">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-zinc-50 transition-colors ${collapsed ? "justify-center" : ""}`}
            >
              <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{user?.full_name || "User"}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                  </div>
                  <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-md border border-zinc-100 shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-zinc-50">
                  <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => { navigate("/dashboard/careertwin/profile"); setProfileOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
                >
                  <User2 size={14} /> Edit profile
                </button>
                <button
                  onClick={() => { localStorage.removeItem("token"); navigate("/login"); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-red-600 transition-colors"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarW }}
      >
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-2 text-sm text-zinc-400 min-w-0">
            <span className="shrink-0">JobScout</span>
            <ChevronRight size={14} className="shrink-0" />
            <span className="text-zinc-900 font-medium truncate">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
              <Search size={16} />
            </button>
            <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
              <Bell size={16} />
            </button>
            <button
              onClick={() => navigate("/dashboard/new")}
              className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-zinc-700 transition-colors whitespace-nowrap"
            >
              <Plus size={14} /> New dashboard
            </button>
            <button
              onClick={() => navigate("/dashboard/products/coverletter")}
              className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-zinc-700 transition-colors whitespace-nowrap"
            >
              <Plus size={14} /> New letter
            </button>
          </div>
        </header>

        {/* Page outlet */}
        <main className="flex-1 min-w-0">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}

// /* eslint-disable react-hooks/set-state-in-effect */
// import { useEffect, useState, useRef } from "react";
// import { useNavigate, useLocation, Outlet, NavLink } from "react-router-dom";
// import {
//   LayoutDashboard, Briefcase, User2, LogOut,
//   ChevronDown, Bell, Plus, Search, ChevronRight,
//   FileText, Mail, PanelLeftClose, PanelLeftOpen,
//   Package, BookOpen, Folder,
// } from "lucide-react";

// const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// const SIDEBAR_OPEN = 256;
// const SIDEBAR_CLOSED = 64;

// type UserProfile = {
//   id: string;
//   email: string;
//   full_name: string;
//   display_name: string | null;
// };

// type NavGroup = {
//   label: string;
//   icon: React.ReactNode;
//   path?: string;
//   children?: { label: string; path: string; icon: React.ReactNode }[];
// };

// const navGroups: NavGroup[] = [
//   {
//     label: "Overview",
//     icon: <LayoutDashboard size={16} />,
//     path: "/dashboard/overview",
//   },
//   {
//     label: "Dashboards",
//     icon: <Briefcase size={16} />,
//     children: [
//       { label: "All Jobs", path: "/dashboard/jobs", icon: <Folder size={13} /> },
//     ],
//   },
//   {
//     label: "Career Twin",
//     icon: <User2 size={16} />,
//     children: [
//       { label: "Profile", path: "/dashboard/careertwin/profile", icon: <User2 size={13} /> },
//       { label: "Information", path: "/dashboard/careertwin/info", icon: <BookOpen size={13} /> },
//     ],
//   },
//   {
//     label: "Products",
//     icon: <Package size={16} />,
//     children: [
//       { label: "My CV", path: "/dashboard/products/cv", icon: <FileText size={13} /> },
//       { label: "Cover Letter", path: "/dashboard/products/coverletter", icon: <Mail size={13} /> },
//     ],
//   },
// ];

// function SidebarGroup({
//   group,
//   collapsed,
//   defaultOpen = false,
// }: {
//   group: NavGroup;
//   collapsed: boolean;
//   defaultOpen?: boolean;
// }) {
//   const location = useLocation();
//   const [open, setOpen] = useState(defaultOpen);

//   // Auto-open if a child is active
//   useEffect(() => {
//     if (group.children?.some((c) => location.pathname.startsWith(c.path))) {
//       setOpen(true);
//     }
//   }, [location.pathname]);

//   const isActive = group.path
//     ? location.pathname === group.path
//     : group.children?.some((c) => location.pathname.startsWith(c.path));

//   const baseBtn = `w-full flex items-center px-3 py-2 rounded-md text-sm transition-colors`;
//   const activeClass = "bg-zinc-100 text-zinc-900 font-medium";
//   const inactiveClass = "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900";

//   if (group.path) {
//     return (
//       <NavLink
//         to={group.path}
//         title={collapsed ? group.label : undefined}
//         className={`${baseBtn} gap-2.5 ${isActive ? activeClass : inactiveClass} ${collapsed ? "justify-center" : ""}`}
//       >
//         <span className="shrink-0">{group.icon}</span>
//         {!collapsed && group.label}
//       </NavLink>
//     );
//   }

//   return (
//     <div>
//       <button
//         onClick={() => !collapsed && setOpen((v) => !v)}
//         title={collapsed ? group.label : undefined}
//         className={`${baseBtn} ${isActive ? activeClass : inactiveClass} ${collapsed ? "justify-center gap-0" : "justify-between gap-2"}`}
//       >
//         <div className="flex items-center gap-2.5">
//           <span className="shrink-0">{group.icon}</span>
//           {!collapsed && group.label}
//         </div>
//         {!collapsed && (
//           <ChevronDown
//             size={13}
//             className={`text-zinc-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
//           />
//         )}
//       </button>

//       {!collapsed && open && group.children && (
//         <ul className="ml-4 pl-3 border-l border-zinc-100 mt-1 flex flex-col gap-0.5">
//           {group.children.map((child) => {
//             const childActive = location.pathname === child.path;
//             return (
//               <li key={child.path}>
//                 <NavLink
//                   to={child.path}
//                   className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors ${
//                     childActive
//                       ? "text-zinc-900 font-medium bg-zinc-50"
//                       : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
//                   }`}
//                 >
//                   <span className="shrink-0 text-zinc-400">{child.icon}</span>
//                   {child.label}
//                 </NavLink>
//               </li>
//             );
//           })}
//         </ul>
//       )}
//     </div>
//   );
// }

// export default function DashboardLayout() {
//   const navigate = useNavigate();
//   const location = useLocation();
//   const [user, setUser] = useState<UserProfile | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [profileOpen, setProfileOpen] = useState(false);
//   const [collapsed, setCollapsed] = useState(false);
//   const profileRef = useRef<HTMLDivElement>(null);

//   const sidebarW = collapsed ? SIDEBAR_CLOSED : SIDEBAR_OPEN;

//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     if (!token) { navigate("/login"); return; }
//     fetch(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((r) => {
//         if (r.status === 401) { localStorage.removeItem("token"); navigate("/login"); return null; }
//         return r.json();
//       })
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

//   // Derive breadcrumb label from current path
//   const breadcrumb = (() => {
//     const p = location.pathname;
//     if (p.includes("overview")) return "Overview";
//     if (p.includes("jobs")) return "All Jobs";
//     if (p.includes("careertwin/profile")) return "Profile";
//     if (p.includes("careertwin/info")) return "Information";
//     if (p.includes("products/cv")) return "My CV";
//     if (p.includes("products/coverletter")) return "Cover Letter";
//     return "Dashboard";
//   })();

//   return (
//     <div className="min-h-screen bg-zinc-50 font-['DM_Sans',sans-serif]">

//       {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
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

//         {/* Nav groups */}
//         <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 flex flex-col gap-1">
//           {navGroups.map((group) => (
//             <SidebarGroup
//               key={group.label}
//               group={group}
//               collapsed={collapsed}
//               defaultOpen={
//                 group.label === "Career Twin" ||
//                 group.label === "Products" ||
//                 group.label === "Dashboards"
//               }
//             />
//           ))}
//         </nav>

//         {/* Profile footer */}
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
//                   onClick={() => { navigate("/dashboard/careertwin/profile"); setProfileOpen(false); }}
//                   className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors"
//                 >
//                   <User2 size={14} /> Edit profile
//                 </button>
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

//       {/* ── MAIN ───────────────────────────────────────────────────────── */}
//       <div
//         className="flex flex-col min-h-screen transition-all duration-200"
//         style={{ marginLeft: sidebarW }}
//       >
//         {/* Topbar */}
//         <header className="h-14 bg-white border-b border-zinc-100 flex items-center justify-between px-6 sticky top-0 z-30 shrink-0">
//           <div className="flex items-center gap-2 text-sm text-zinc-400 min-w-0">
//             <span className="shrink-0">JobScout</span>
//             <ChevronRight size={14} className="shrink-0" />
//             <span className="text-zinc-900 font-medium truncate">{breadcrumb}</span>
//           </div>
//           <div className="flex items-center gap-2 shrink-0">
//             <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
//               <Search size={16} />
//             </button>
//             <button className="p-2 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors">
//               <Bell size={16} />
//             </button>
//             <button
//               onClick={() => navigate("/dashboard/products/coverletter")}
//               className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-semibold px-3 py-2 rounded-md hover:bg-zinc-700 transition-colors whitespace-nowrap"
//             >
//               <Plus size={14} /> New letter
//             </button>
//           </div>
//         </header>

//         {/* Page outlet */}
//         <main className="flex-1 min-w-0">
//           <Outlet context={{ user }} />
//         </main>
//       </div>
//     </div>
//   );
// }