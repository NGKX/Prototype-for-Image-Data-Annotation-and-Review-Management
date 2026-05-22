import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, createProject } from "@/services/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderOpen } from "lucide-react";
import type { Project } from "@/types/project";

export default function ProjectListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data.items || []);
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
      const p = await createProject({ name: name.trim(), description: desc.trim() || undefined });
      setProjects((prev) => [p, ...prev]);
      setName(""); setDesc(""); setShowForm(false);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">项目管理</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" /> 创建项目
        </Button>
      </div>

      {showForm && (
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
          <p>暂无项目，点击"创建项目"开始</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => navigate(`/projects/${p.id}/images`)}
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
                <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                  <span>图片: {p.image_count}</span>
                  <span>已标注: {p.annotated_count}</span>
                  <span>已审核: {p.approved_count}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
