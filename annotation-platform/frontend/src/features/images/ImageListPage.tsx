import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getImages, uploadImages, autoAnnotate, deleteImage, toggleSensitive } from "@/services/images";
import { getProject } from "@/services/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/authStore";
import { Upload, Search, Image as ImageIcon, Sparkles, ClipboardCheck, Trash2, ShieldAlert } from "lucide-react";
import type { Project } from "@/types/project";

const statusLabel: Record<string, string> = {
  unannotated: "未标注", annotating: "标注中", annotated: "已标注", under_review: "审核中",
};
const reviewLabel: Record<string, string> = {
  pending: "待审核", pre_approved: "预通过", approved: "已通过", rejected: "已退回", rework: "待修改",
};

export default function ImageListPage() {
  const { pid } = useParams();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [annoFilter, setAnnoFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");

  async function load() {
    if (!pid) return;
    setLoading(true);
    try {
      const [proj, data] = await Promise.all([
        getProject(pid),
        getImages(pid, {
          page, page_size: 20,
          annotation_status: annoFilter || undefined,
          review_status: reviewFilter || undefined,
          search: search || undefined,
        }),
      ]);
      setProject(proj);
      setImages(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [pid, page, annoFilter, reviewFilter]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !pid) return;
    setUploading(true);
    try {
      await uploadImages(pid, Array.from(files));
      setPage(1);
      await load();
    } catch (err) { console.error(err); }
    finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || "annotator";
  const canReview = userRole === "admin" || userRole === "reviewer";
  const canAutoAnnotate = userRole === "admin" || userRole === "data_manager";

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.name || "图片列表"}</h1>
          <p className="text-sm text-muted-foreground">共 {total} 张图片</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-yellow-600 flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5" />
            上传前请确保数据已脱敏处理
          </p>
          <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Upload className="mr-1 h-4 w-4" />
            {uploading ? "上传中..." : "上传图片"}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索文件名..."
            className="pl-8"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          />
        </div>
        <select className="rounded-md border px-3 py-1 text-sm" value={annoFilter} onChange={(e) => { setAnnoFilter(e.target.value); setPage(1); }}>
          <option value="">标注状态: 全部</option>
          <option value="unannotated">未标注</option>
          <option value="annotated">已标注</option>
          <option value="under_review">审核中</option>
        </select>
        <select className="rounded-md border px-3 py-1 text-sm" value={reviewFilter} onChange={(e) => { setReviewFilter(e.target.value); setPage(1); }}>
          <option value="">审核状态: 全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已退回</option>
        </select>
      </div>

      {/* Image Grid */}
      {loading ? (
        <p className="py-10 text-center text-muted-foreground">加载中...</p>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ImageIcon className="mb-2 h-12 w-12" />
          <p>暂无图片，点击"上传图片"开始</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {images.map((img: any) => {
            const isPending = img.review_status === "pending" && img.annotation_status === "annotated";
            const clickTarget = (isPending && canReview)
              ? `/projects/${pid}/review/${img.id}`
              : `/projects/${pid}/annotate/${img.id}`;
            return (
            <Card key={img.id} className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => navigate(clickTarget)}>
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {img.thumbnail_url ? (
                  <img src={img.thumbnail_url} alt={img.original_name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium" title={img.original_name}>{img.original_name}</p>
                <div className="mt-1 flex gap-1 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{statusLabel[img.annotation_status] || img.annotation_status}</Badge>
                  <Badge variant={img.review_status === "approved" ? "success" : img.review_status === "rejected" ? "destructive" : "outline"} className="text-xs">
                    {reviewLabel[img.review_status] || img.review_status}
                  </Badge>
                  {img.is_sensitive && (
                    <Badge variant="destructive" className="text-xs flex items-center gap-0.5">
                      <ShieldAlert className="h-2.5 w-2.5" />
                      含敏感数据
                    </Badge>
                  )}
                </div>
                {img.width && <p className="mt-1 text-xs text-muted-foreground">{img.width}×{img.height}</p>}
                {img.sensitive_note && (
                  <p className="mt-0.5 text-xs text-yellow-600 truncate" title={img.sensitive_note}>
                    ⚠ {img.sensitive_note}
                  </p>
                )}
                <div className="mt-2 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {canAutoAnnotate && (
                    <Button variant="outline" size="sm" className="text-xs h-7"
                      onClick={async () => {
                        try { await autoAnnotate(img.id); load(); }
                        catch (err) { console.error(err); }
                      }}>
                      <Sparkles className="mr-1 h-3 w-3" /> 自动标注
                    </Button>
                  )}
                  {isPending && canReview && (
                    <Button variant="default" size="sm" className="text-xs h-7"
                      onClick={() => navigate(`/projects/${pid}/review/${img.id}`)}>
                      <ClipboardCheck className="mr-1 h-3 w-3" /> 审核
                    </Button>
                  )}
                  {canAutoAnnotate && (
                    <Button variant="ghost" size="sm" className={`text-xs h-7 ${img.is_sensitive ? "text-yellow-600" : "text-muted-foreground"}`}
                      title={img.is_sensitive ? "取消敏感标记" : "标记为敏感数据"}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const note = img.is_sensitive ? undefined : (prompt("敏感数据说明（选填）：") || undefined);
                        try { await toggleSensitive(img.id, !img.is_sensitive, note); load(); }
                        catch (err) { console.error(err); }
                      }}>
                      <ShieldAlert className="h-3 w-3" />
                    </Button>
                  )}
                  {canAutoAnnotate && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-red-500 hover:text-red-700"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!window.confirm("确定要删除该图片吗？")) return;
                        try { await deleteImage(img.id); load(); }
                        catch (err) { console.error(err); }
                      }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}
