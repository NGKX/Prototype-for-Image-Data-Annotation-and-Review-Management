import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { RoleBadge } from "@/components/status-badge";
import { LogOut, Grid3X3 } from "lucide-react";

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="h-11 bg-[#1d1d1f] flex items-center justify-between px-5 flex-shrink-0 z-10 select-none">
      <div className="flex items-center gap-6">
        <NavLink to="/dashboard" className="flex items-center gap-2 text-white/90 hover:text-white transition-colors">
          <Grid3X3 className="h-4 w-4" />
          <span className="text-sm font-semibold tracking-tight">DataLens</span>
        </NavLink>
        <nav className="hidden sm:flex items-center gap-4">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) =>
                `text-xs transition-colors ${isActive ? "text-white" : "text-white/50 hover:text-white/80"}`
              }>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-xs text-white/60">{user.display_name || user.username}</span>
            <RoleBadge role={user.role} />
          </>
        )}
        <button onClick={logout}
          className="text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1">
          <LogOut className="h-3 w-3" />
        </button>
      </div>
    </header>
  );
}

const links = [
  { to: "/dashboard", label: "概览" },
  { to: "/projects", label: "项目" },
  { to: "/stats", label: "统计" },
];
