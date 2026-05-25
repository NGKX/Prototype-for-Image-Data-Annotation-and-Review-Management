import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { getOverview } from "@/services/stats";
import { getProjects } from "@/services/projects";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, ArrowRight, FolderOpen, Image, TrendingUp, Clock, PenTool } from "lucide-react";
import type { Project } from "@/types/project";

const actionLabel: Record<string, string> = { approved: "通过", rejected: "退回" };

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
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--apple-ink-48)]">加载中...</p>
      </div>
    );
  }

  const roleName = role === "admin" ? "管理员" : role === "data_manager" ? "数据管理员" : role === "reviewer" ? "审核员" : "标注员";

  return (
    <div className="space-y-6 p-4 md:p-6 fade-in max-w-5xl mx-auto">
      {/* Hero */}
      <section className="text-center py-6 md:py-10">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#1d1d1f]">
          你好，{user?.display_name || user?.username}
        </h1>
        <p className="mt-2 text-lg text-[#86868b] font-light">
          {roleName} · 项目进度 {overview?.progress ?? 0}%
        </p>
        <div className="mt-6 h-1.5 w-48 mx-auto rounded-full bg-[#e5e5e7] overflow-hidden">
          <div className="h-full rounded-full bg-[#0066cc] transition-all duration-700"
            style={{ width: `${overview?.progress ?? 0}%` }} />
        </div>
      </section>

      {/* Stat cards */}
      <section className=" grid grid-cols-2 md:grid-cols-4 gap-4">
        <button onClick={() => navigate("/projects")}
          className="card-apple text-center py-8 hover:border-[#0066cc] transition-colors cursor-pointer group">
          <FolderOpen className="mx-auto h-6 w-6 text-[#86868b] group-hover:text-[#0066cc] transition-colors mb-2" />
          <p className="stat-number text-[#1d1d1f]">{overview?.projects?.total ?? 0}</p>
          <p className="text-sm text-[#86868b] font-medium mt-1">活跃项目</p>
        </button>
        <div className="card-apple text-center py-8">
          <Image className="mx-auto h-6 w-6 text-[#86868b] mb-2" />
          <p className="stat-number text-[#1d1d1f]">{overview?.images?.total ?? 0}</p>
          <p className="text-sm text-[#86868b] font-medium mt-1">图片总数</p>
        </div>
        <div className="card-apple text-center py-8">
          {role === "annotator" ? (
            <PenTool className="mx-auto h-6 w-6 text-[#ff9f0a] mb-2" />
          ) : (
            <Clock className="mx-auto h-6 w-6 text-[#0066cc] mb-2" />
          )}
          <p className="stat-number text-[#0066cc]">{overview?.my_todos ?? 0}</p>
          <p className="text-sm text-[#86868b] font-medium mt-1">{overview?.todo_label || "待处理"}</p>
        </div>
        <div className="card-apple text-center py-8">
          <CheckCircle className="mx-auto h-6 w-6 text-[#86868b] mb-2" />
          <p className="stat-number text-[#1d1d1f]">{overview?.images?.approved ?? 0}</p>
          <p className="text-sm text-[#86868b] font-medium mt-1">审核通过</p>
        </div>
      </section>

      {/* Activity feed */}
      <section className="">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">最近动态</h2>
        </div>
        <div className="card-apple p-0 overflow-hidden">
          {overview?.recent_reviews?.length > 0 ? (
            overview.recent_reviews.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafc] transition-colors">
                {r.action === "approved" ? (
                  <CheckCircle className="h-4 w-4 text-[#34c759] flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-[#ff3b30] flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-[#333333]">{r.reviewer}</span>
                <Badge variant={r.action === "approved" ? "success" : "destructive"} className="text-[11px]">{actionLabel[r.action] || r.action}</Badge>
                {r.reason && <span className="text-sm text-[#86868b] truncate">— {r.reason}</span>}
                <span className="ml-auto text-xs text-[#86868b]">{r.created_at ? new Date(r.created_at).toLocaleDateString() : ""}</span>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-[#86868b]">暂无审核记录</div>
          )}
        </div>
      </section>

      {/* Projects */}
      {projects.length > 0 && (
        <section className="">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold tracking-tight text-[#1d1d1f]">最近项目</h2>
            <button onClick={() => navigate("/projects")}
              className="text-sm text-[#0066cc] hover:underline flex items-center gap-1">
              查看全部 <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id}
                onClick={() => navigate(`/projects/${p.id}/images`)}
                className="card-apple p-4 cursor-pointer hover:border-[#0066cc] transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-[#86868b] group-hover:text-[#0066cc] transition-colors" />
                  <div>
                    <p className="text-[15px] font-medium text-[#1d1d1f]">{p.name}</p>
                    <p className="text-xs text-[#86868b]">
                      {(p as any).image_count != null && `${(p as any).image_count} 张图片`}
                      {(p as any).annotated_count != null && ` · ${(p as any).annotated_count} 已标注`}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#86868b] opacity-0 group-hover:opacity-100 transition-all" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
