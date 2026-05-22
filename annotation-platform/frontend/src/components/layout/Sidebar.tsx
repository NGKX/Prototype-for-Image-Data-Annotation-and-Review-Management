import { NavLink } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  BarChart3,
  Trash2,
  Tags,
  Image,
  ClipboardCheck,
  Download,
} from "lucide-react";
import type { Role } from "@/types/user";

interface NavItemDef {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: Role[];
}

const navItems: NavItemDef[] = [
  { to: "/dashboard", label: "仪表盘", icon: <LayoutDashboard className="h-4 w-4" />, roles: ["admin", "data_manager", "reviewer", "annotator"] },
  { to: "/projects", label: "项目管理", icon: <FolderOpen className="h-4 w-4" />, roles: ["admin", "data_manager"] },
  { to: "/stats", label: "人员统计", icon: <BarChart3 className="h-4 w-4" />, roles: ["admin", "data_manager"] },
  { to: "/trash", label: "回收站", icon: <Trash2 className="h-4 w-4" />, roles: ["admin", "data_manager"] },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  );

export default function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "annotator";

  const visibleItems = navItems.filter((item) => item.roles.includes(role as Role));

  return (
    <aside className="flex w-56 flex-col border-r bg-white pt-4">
      <nav className="flex flex-col gap-1 px-3">
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
