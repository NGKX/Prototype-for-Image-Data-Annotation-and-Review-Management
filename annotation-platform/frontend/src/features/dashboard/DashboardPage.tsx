import { useAuthStore } from "@/store/authStore";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>
      <p className="text-muted-foreground">欢迎回来，{user?.display_name || user?.username}</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">项目进度</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">功能开发中</p>
            <p className="text-xs text-muted-foreground">Phase 2 将实现完整的仪表盘统计</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">我的待办</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">0</p>
            <p className="text-xs text-muted-foreground">Phase 2 将展示待处理任务</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">审核动态</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">Phase 6 将展示最近审核记录</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
