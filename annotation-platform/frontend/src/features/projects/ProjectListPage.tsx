import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, createProject, joinProject, leaveProject } from "@/services/projects";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderOpen, LogIn, LogOut } from "lucide-react";
import type { Project } from "@/types/project";

export default function ProjectListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = user?.role || "annotator";

  const [projects, setProjects] = useState<Project[]>([]);
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data.items || []);

      // Load membership status for annotators
      if (role === "annotator" || role === "reviewer") {
        const { checkMembership } = await import("@/services/projects");
        const members = new Set<string>();
        await Promise.all(
          (data.items || []).map(async (p: Project) => {
            try {
              const r = await checkMembership(p.id);
              if (r.is_member) members.add(p.id);
            } catch (_) {}
          })
        );
        setMemberOf(members);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createProject({ name: name.trim(), description: desc.trim() || undefined });
      setName(""); setDesc(""); setShowForm(false);
      load();
    } catch (e) { console.error(e); }
  }

  async function handleJoin(projectId: string) {
    try {
      await joinProject(projectId);
      setMemberOf((prev) => new Set([...prev, projectId]));
    } catch (e) { console.error(e); }
  }

  async function handleLeave(projectId: string) {
    try {
      await leaveProject(projectId);
      setMemberOf((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    } catch (e) { console.error(e); }
  }

  const canManage = role === "admin" || role === "data_manager";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">项目管理</h1>
        {canManage && (
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-1 h-4 w-4" /> 创建项目
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <Card>
          <CardContent className="flex gap-3 pt-6">
            <Input placeholder="项目名称" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Input placeholder="描述（选填）" value={desc} onChange={(e) => setDesc(e.target.value)} className="flex-1" />
            <Button onClick={handleCreate}>确认创建</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>取消</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="mb-2 h-12 w-12" />
          <p>暂无项目{canManage && "，点击\"创建项目\"开始"}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const isMember = memberOf.has(p.id) || canManage;
            return (
              <Card
                key={p.id}
                className={`cursor-pointer transition-all hover:shadow-md ${isMember ? "border-primary/30" : ""}`}
                onClick={() => isMember ? navigate(`/projects/${p.id}/images`) : null}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">{p.description || "无描述"}</p>
                    </div>
                    <Badge variant={p.status === "active" ? "success" : "secondary"}>
                      {p.status === "active" ? "活跃" : "已归档"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>图片: {p.image_count}</span>
                      <span>已标注: {p.annotated_count}</span>
                      <span>已审核: {p.approved_count}</span>
                    </div>
                    {!canManage && (
                      isMember ? (
                        <Button variant="outline" size="sm" className="text-xs h-7"
                          onClick={(e) => { e.stopPropagation(); handleLeave(p.id); }}>
                          <LogOut className="mr-1 h-3 w-3" /> 退出
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="text-xs h-7"
                          onClick={(e) => { e.stopPropagation(); handleJoin(p.id); }}>
                          <LogIn className="mr-1 h-3 w-3" /> 加入
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
