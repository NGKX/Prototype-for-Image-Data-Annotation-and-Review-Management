import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getImages, uploadImages } from "@/services/images";
import { getProject } from "@/services/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Search, Image as ImageIcon } from "lucide-react";
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

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.name || "图片列表"}</h1>
          <p className="text-sm text-muted-foreground">共 {total} 张图片</p>
        </div>
        <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
          <Upload className="mr-1 h-4 w-4" />
          {uploading ? "上传中..." : "上传图片"}
        </Button>
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
          {images.map((img: any) => (
            <Card key={img.id} className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => navigate(`/projects/${pid}/annotate/${img.id}`)}>
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                {img.thumbnail_url ? (
                  <img src={img.thumbnail_url} alt={img.original_name} className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-300" />
                )}
              </div>
              <CardContent className="p-3">
                <p className="truncate text-sm font-medium" title={img.original_name}>{img.original_name}</p>
                <div className="mt-1 flex gap-1">
                  <Badge variant="secondary" className="text-xs">{statusLabel[img.annotation_status] || img.annotation_status}</Badge>
                  <Badge variant={img.review_status === "approved" ? "success" : img.review_status === "rejected" ? "destructive" : "outline"} className="text-xs">
                    {reviewLabel[img.review_status] || img.review_status}
                  </Badge>
                </div>
                {img.width && <p className="mt-1 text-xs text-muted-foreground">{img.width}×{img.height}</p>}
              </CardContent>
            </Card>
          ))}
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
