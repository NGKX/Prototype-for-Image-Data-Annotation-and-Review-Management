import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderOpen, BarChart3, Trash2, Users } from "lucide-react";
import type { Role } from "@/types/user";

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItemDef[] = [
  { to: "/dashboard", label: "概览", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "data_manager", "reviewer", "annotator"] },
  { to: "/projects", label: "项目", icon: <FolderOpen className="h-4 w-4" />, roles: ["admin", "data_manager", "reviewer", "annotator"] },
  { to: "/stats", label: "统计", icon: <BarChart3 className="h-4 w-4" />, roles: ["admin", "data_manager"] },
  { to: "/trash", label: "回收站", icon: <Trash2 className="h-4 w-4" />, roles: ["admin", "data_manager"] },
  { to: "/users", label: "用户管理", icon: <Users className="h-4 w-4" />, roles: ["admin"] },
];

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "annotator";
  const visibleItems = navItems.filter((item) => item.roles.includes(role as Role));

  if (visibleItems.length <= 1) return null;

  return (
    <aside className="flex flex-col border-r border-[#e5e5e7] bg-[#f5f5f7] py-4 w-[68px] flex-shrink-0">
      <nav className="flex flex-col items-center gap-1 px-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 w-full text-[11px] font-medium transition-colors",
                isActive
                  ? "bg-white text-[var(--apple-blue)] shadow-sm"
                  : "text-[var(--apple-ink-48)] hover:text-[var(--apple-ink-80)] hover:bg-black/[0.04]"
              )
            }
          >
            {item.icon}
            <span className="leading-none">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
