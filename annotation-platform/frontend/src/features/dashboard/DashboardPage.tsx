import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { getOverview } from "@/services/stats";
import { getProjects } from "@/services/projects";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderOpen, Image, PenTool, CheckCircle, XCircle,
  Clock, TrendingUp, AlertCircle, ArrowRight,
} from "lucide-react";
import type { Project } from "@/types/project";

const actionLabel: Record<string, string> = {
  approved: "通过", rejected: "退回",
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const role = user?.role || "annotator";

  const [overview, setOverview] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOverview().catch(() => null),
      getProjects(1, 5).catch(() => ({ items: [] })),
    ]).then(([ov, projData]) => {
      setOverview(ov);
      setProjects((projData as any).items || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>
      <p className="text-muted-foreground">
        欢迎回来，{user?.display_name || user?.username}
        <Badge variant="outline" className="ml-2 text-xs">
          {role === "admin" ? "管理员" : role === "data_manager" ? "数据管理员" : role === "reviewer" ? "审核员" : "标注员"}
        </Badge>
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">项目进度</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">{overview?.progress ?? 0}%</p>
                <p className="text-xs text-muted-foreground">
                  {overview?.images?.annotated ?? 0} / {overview?.images?.total ?? 0} 张已标注
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${overview?.progress ?? 0}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">我的待办</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold">{overview?.my_todos ?? 0}</p>
                <p className="text-xs text-muted-foreground">{overview?.todo_label || "无待办"}</p>
              </div>
              {role === "annotator" ? (
                <PenTool className="h-8 w-8 text-orange-500" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-500" />
              )}
            </div>
            {overview?.my_todos > 0 && (
              <Button variant="link" size="sm" className="mt-2 h-auto p-0 text-xs"
                onClick={() => navigate("/projects")}>
                去处理 <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">审核动态</CardTitle>
          </CardHeader>
          <CardContent>
            {overview?.recent_reviews?.length > 0 ? (
              <div className="space-y-2">
                {overview.recent_reviews.slice(0, 3).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {r.action === "approved" ? (
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground">{r.reviewer}</span>
                    <Badge variant={r.action === "approved" ? "success" : "destructive"} className="text-[10px]">
                      {actionLabel[r.action] || r.action}
                    </Badge>
                    {r.reason && <span className="truncate text-muted-foreground">— {r.reason}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-2 text-muted-foreground">
                <Clock className="h-6 w-6 mb-1" />
                <p className="text-xs">暂无审核记录</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick stats row */}
      {overview && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <FolderOpen className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-lg font-bold">{overview.projects?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">活跃项目</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <Image className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-lg font-bold">{overview.images?.total ?? 0}</p>
              <p className="text-xs text-muted-foreground">图片总数</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-lg font-bold">{overview.images?.approved ?? 0}</p>
              <p className="text-xs text-muted-foreground">审核通过</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-lg font-bold">{overview.images?.rejected ?? 0}</p>
              <p className="text-xs text-muted-foreground">审核退回</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent projects */}
      {projects.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">最近项目</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
              查看全部 <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projects.map((p) => (
                <div key={p.id}
                  className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/projects/${p.id}/images`)}>
                  <div className="flex items-center gap-3">
                    <FolderOpen className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.description || ""}
                        {(p as any).image_count != null && ` · ${(p as any).image_count} 张图片`}
                        {(p as any).annotated_count != null && ` · ${(p as any).annotated_count} 已标注`}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
