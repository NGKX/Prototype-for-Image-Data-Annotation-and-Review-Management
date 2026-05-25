import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects } from "@/services/projects";
import { getTrashImages, restoreImage, permanentDeleteImage } from "@/services/images";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trash2, RotateCcw, AlertTriangle, Image as ImageIcon, FolderOpen,
} from "lucide-react";
import type { Project } from "@/types/project";

export default function TrashPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedPid, setSelectedPid] = useState<string>("");
  const [images, setImages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pageSize = 20;

  useEffect(() => {
    getProjects(1, 100).then((data) => {
      setProjects(data.items || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedPid) return;
    setLoading(true);
    getTrashImages(selectedPid, { page, page_size: pageSize })
      .then((data) => {
        setImages(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPid, page]);

  async function handleRestore(imageId: string) {
    setActionLoading(imageId);
    try {
      await restoreImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setTotal((t) => t - 1);
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  async function handlePermanentDelete(imageId: string) {
    if (!window.confirm("确定要永久删除该图片吗？此操作不可撤销。")) return;
    setActionLoading(imageId);
    try {
      await permanentDeleteImage(imageId);
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      setTotal((t) => t - 1);
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">回收站</h1>
      </div>

      {/* Project selector */}
      <div className="flex items-center gap-3">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <select
          className="rounded-md border px-3 py-2 text-sm min-w-[240px]"
          value={selectedPid}
          onChange={(e) => { setSelectedPid(e.target.value); setPage(1); }}
        >
          <option value="">-- 选择项目 --</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {!selectedPid ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <FolderOpen className="mb-2 h-12 w-12" />
          <p>请选择一个项目以查看已删除的图片</p>
        </div>
      ) : loading ? (
        <p className="py-10 text-center text-muted-foreground">加载中...</p>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Trash2 className="mb-2 h-12 w-12" />
          <p>回收站为空</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">共 {total} 张已删除图片</p>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img: any) => (
              <Card key={img.id} className="overflow-hidden">
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  {img.thumbnail_url ? (
                    <img src={img.thumbnail_url} alt={img.original_name} className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="truncate text-sm font-medium" title={img.original_name}>{img.original_name}</p>
                  {img.width && <p className="text-xs text-muted-foreground">{img.width}×{img.height}</p>}
                  {img.deleted_at && (
                    <p className="text-xs text-muted-foreground">
                      删除于: {new Date(img.deleted_at).toLocaleDateString()}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1">
                    <Button
                      variant="outline" size="sm" className="text-xs h-7"
                      disabled={actionLoading === img.id}
                      onClick={() => handleRestore(img.id)}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      {actionLoading === img.id ? "恢复中..." : "恢复"}
                    </Button>
                    <Button
                      variant="destructive" size="sm" className="text-xs h-7"
                      disabled={actionLoading === img.id}
                      onClick={() => handlePermanentDelete(img.id)}
                    >
                      <AlertTriangle className="mr-1 h-3 w-3" />
                      彻底删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
