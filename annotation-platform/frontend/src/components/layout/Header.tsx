import { useAuthStore } from "@/store/authStore";
import { RoleBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function Header() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold text-primary">标注平台</span>
        <span className="text-sm text-muted-foreground">| 图片数据标注与审核管理</span>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm font-medium">{user.display_name || user.username}</span>
            <RoleBadge role={user.role} />
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-1 h-4 w-4" /> 退出
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
