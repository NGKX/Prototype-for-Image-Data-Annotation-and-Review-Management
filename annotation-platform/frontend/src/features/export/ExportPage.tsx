import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { getProject } from "@/services/projects";
import { listExports, createExport, getExportStatus, getExportDownloadUrl, deleteExport } from "@/services/export";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Download, FileArchive, Trash2, RefreshCw, Loader2 } from "lucide-react";

const FORMATS = [
  { value: "yolo", label: "YOLO", desc: "images/ + labels/ + classes.txt" },
  { value: "coco", label: "COCO", desc: "annotations.json" },
  { value: "voc", label: "VOC", desc: "JPEGImages/ + Annotations/ .xml" },
];

const statusBadge = (s: string) => {
  const m: Record<string, "default" | "secondary" | "success" | "destructive"> = {
    processing: "secondary", completed: "success", failed: "destructive",
  };
  return <Badge variant={m[s] || "default"} className="text-xs">{s === "processing" ? "处理中" : s === "completed" ? "已完成" : s === "failed" ? "失败" : s}</Badge>;
};

export default function ExportPage() {
  const { pid } = useParams<{ pid: string }>();
  const [projectName, setProjectName] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [format, setFormat] = useState("yolo");
  const [annoFilter, setAnnoFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const [proj, data] = await Promise.all([
        getProject(pid),
        listExports(pid, { page, page_size: 10 }),
      ]);
      setProjectName(proj.name);
      setRecords(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [pid, page]);

  useEffect(() => { load(); }, [load]);

  // Poll status for processing exports
  useEffect(() => {
    const processing = records.filter((r) => r.status === "processing");
    if (processing.length === 0) return;
    const timer = setInterval(async () => {
      let changed = false;
      for (const r of processing) {
        try {
          const updated = await getExportStatus(r.id);
          if (updated.status !== "processing") {
            changed = true;
          }
        } catch (e) { /* ignore */ }
      }
      if (changed) load();
    }, 5000);
    return () => clearInterval(timer);
  }, [records, load]);

  async function handleCreate() {
    if (!pid) return;
    setCreating(true);
    try {
      const criteria: Record<string, any> = {};
      if (annoFilter) criteria.annotation_status = annoFilter;
      if (reviewFilter) criteria.review_status = reviewFilter;
      await createExport(pid, format, Object.keys(criteria).length > 0 ? criteria : undefined);
      setPage(1);
      await load();
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  }

  async function handleDelete(exportId: string) {
    if (!window.confirm("确定要删除该导出记录吗？")) return;
    try {
      await deleteExport(exportId);
      load();
    } catch (e) { console.error(e); }
  }

  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">{projectName || "数据导出"}</h1>

      {/* Export form */}
      <Card>
        <CardHeader><CardTitle>新建导出</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">导出格式</label>
            <div className="mt-2 flex gap-3">
              {FORMATS.map((f) => (
                <label
                  key={f.value}
                  className={`flex-1 cursor-pointer rounded-lg border-2 p-3 transition-colors ${format === f.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <input
                    type="radio"
                    name="format"
                    value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    className="hidden"
                  />
                  <p className="font-semibold text-sm">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium">标注状态过滤</label>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={annoFilter} onChange={(e) => setAnnoFilter(e.target.value)}>
                <option value="">全部</option>
                <option value="annotated">已标注</option>
                <option value="unannotated">未标注</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">审核状态过滤</label>
              <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
                <option value="">全部</option>
                <option value="approved">已通过</option>
                <option value="rejected">已退回</option>
                <option value="pending">待审核</option>
              </select>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />创建中...</> : <><FileArchive className="mr-2 h-4 w-4" />开始导出</>}
          </Button>
        </CardContent>
      </Card>

      {/* Export history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>导出记录 ({total})</CardTitle>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-center text-muted-foreground">加载中...</p>
          ) : records.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">暂无导出记录</p>
          ) : (
            <div className="space-y-2">
              {records.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <FileArchive className="h-6 w-6 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">{r.export_format.toUpperCase()} 导出</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                        {r.volumes?.image_count != null && ` · ${r.volumes.image_count} 张图片 · ${r.volumes.annotation_count} 个标注`}
                        {r.file_size != null && ` · ${(r.file_size / 1024 / 1024).toFixed(1)} MB`}
                      </p>
                      {r.error_msg && <p className="text-xs text-red-500 mt-0.5">{r.error_msg}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(r.status)}
                    {r.status === "completed" && (
                      <a href={getExportDownloadUrl(r.id)} download>
                        <Button variant="outline" size="sm">
                          <Download className="mr-1 h-3 w-3" />下载
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
