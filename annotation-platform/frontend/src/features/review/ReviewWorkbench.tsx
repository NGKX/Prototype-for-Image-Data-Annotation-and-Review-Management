import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas, Rect, Polygon, FabricImage } from "fabric";
import { getImageDetail, claimReview, releaseReview, approveReview, rejectReview } from "@/services/images";
import { getAnnotations } from "@/services/annotations";
import { getCategories } from "@/services/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

export default function ReviewWorkbench() {
  const { pid, iid } = useParams<{ pid: string; iid: string }>();
  const navigate = useNavigate();

  const canvasRefA = useRef<HTMLCanvasElement>(null);
  const canvasRefB = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [imgInfo, setImgInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reason, setReason] = useState("");

  // Load data
  useEffect(() => {
    if (!iid || !pid) return;
    setLoading(true);
    Promise.all([
      getImageDetail(iid),
      getAnnotations(iid),
      getCategories(pid),
    ]).then(([img, annos, cats]) => {
      setImageUrl(img.presigned_url);
      setImageMeta({ width: img.width, height: img.height });
      setImgInfo(img);
      setAnnotations((annos.items || []).map((a: any) => ({
        id: a.id, type: a.type, geometry: a.geometry,
        categoryId: a.category_id, categoryName: a.category_name,
        categoryColor: a.category_color, isAuto: a.is_auto, confidence: a.confidence,
      })));
      setCategories(cats.items || []);
      setLoading(false);
    }).catch(console.error);

    // Claim the review on mount
    claimReview(iid).catch(() => {});

    return () => {
      releaseReview(iid!).catch(() => {});
    };
  }, [iid, pid]);

  // Initialize dual canvases
  useEffect(() => {
    if (!imageUrl || !imageMeta) return;
    const wrapper = containerRef.current;
    if (!wrapper) return;
    const w = wrapper.clientWidth / 2 - 8;
    const h = wrapper.clientHeight;

    const initCanvas = async (canvasEl: HTMLCanvasElement, showAnnotations: boolean) => {
      canvasEl.width = w;
      canvasEl.height = h;
      const canvas = new Canvas(canvasEl, {
        width: w, height: h,
        backgroundColor: "#1a1a2e",
        selection: false,
      });

      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });
      if (!img.width) return;

      const scale = Math.min(w / img.width, h / img.height) * 0.95;
      img.set({
        left: (w - img.width * scale) / 2,
        top: (h - img.height * scale) / 2,
        scaleX: scale, scaleY: scale,
        selectable: false, evented: false,
      });
      canvas.add(img);
      canvas.sendObjectToBack(img);

      if (showAnnotations) {
        annotations.forEach((a) => {
          const color = a.categoryColor || "#3388FF";
          const vpt = canvas.viewportTransform!;
          const zoom = canvas.getZoom();
          if (a.type === "bbox") {
            const g = a.geometry;
            const r = new Rect({
              left: g.x * zoom + (canvasEl.width - imageMeta.width * scale) / 2,
              top: g.y * zoom + (canvasEl.height - imageMeta.height * scale) / 2,
              width: (g.width || 0) * zoom,
              height: (g.height || 0) * zoom,
              fill: `${color}22`,
              stroke: a.isAuto ? "#FF9800" : color,
              strokeWidth: 2 / zoom,
              strokeDashArray: a.isAuto ? [6, 4] : [],
              selectable: false,
              evented: false,
            });
            // Scale relative to image
            r.set({
              left: (a.geometry.x * scale) + (w - imageMeta.width * scale) / 2,
              top: (a.geometry.y * scale) + (h - imageMeta.height * scale) / 2,
              width: (a.geometry.width || 0) * scale,
              height: (a.geometry.height || 0) * scale,
              strokeWidth: 2,
            });
            canvas.add(r);
          }
          if (a.type === "polygon" && a.geometry.points) {
            const pts = a.geometry.points.map(([x, y]: number[]) => ({
              x: x * scale + (w - imageMeta.width * scale) / 2,
              y: y * scale + (h - imageMeta.height * scale) / 2,
            }));
            if (pts.length >= 3) {
              const poly = new Polygon(pts, {
                fill: `${color}22`, stroke: color,
                strokeWidth: 2, selectable: false, evented: false,
              });
              canvas.add(poly);
            }
          }
        });
      }

      canvas.renderAll();
      return canvas;
    };

    const init = async () => {
      if (canvasRefA.current) await initCanvas(canvasRefA.current, false);
      if (canvasRefB.current) await initCanvas(canvasRefB.current, true);
    };
    init();

    return () => {
      // Cleanup canvases
    };
  }, [imageUrl, imageMeta, annotations]);

  async function handleApprove() {
    if (!iid) return;
    setActionLoading(true);
    try {
      await approveReview(iid, reason || undefined);
      navigate(`/projects/${pid}/images`);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  }

  async function handleReject() {
    if (!iid || !reason.trim()) return;
    setActionLoading(true);
    try {
      await rejectReview(iid, reason);
      navigate(`/projects/${pid}/images`);
    } catch (e) { console.error(e); }
    finally { setActionLoading(false); }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">加载审核面板...</p>
      </div>
    );
  }

  const autoCount = annotations.filter((a) => a.isAuto).length;
  const manualCount = annotations.length - autoCount;

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${pid}/images`)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> 返回
          </Button>
          <span className="text-sm font-medium">
            {imgInfo?.original_name || "审核图片"}
          </span>
          <span className="text-sm text-muted-foreground">
            | {imgInfo?.width}×{imgInfo?.height}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            标注: {annotations.length}个 (自动: {autoCount}, 手动: {manualCount})
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Dual canvas area */}
        <div ref={containerRef} className="flex flex-1 gap-4 p-2">
          {/* Original image */}
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">原始图片</div>
            <canvas ref={canvasRefA} className="flex-1 w-full" />
          </div>
          {/* Annotated image */}
          <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b">标注结果</div>
            <canvas ref={canvasRefB} className="flex-1 w-full" />
          </div>
        </div>

        {/* Right panel: annotations + actions */}
        <div className="w-64 border-l p-3 flex flex-col overflow-y-auto">
          <h4 className="mb-2 text-sm font-semibold">标注列表</h4>
          <div className="flex-1 space-y-1 mb-4">
            {annotations.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂未标注</p>
            ) : (
              annotations.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs bg-gray-50">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: a.categoryColor || "#999" }}
                  />
                  <span className="flex-1 truncate">{a.categoryName || a.type}</span>
                  {a.isAuto && <Badge variant="outline" className="text-[10px]">auto</Badge>}
                  {a.confidence != null && (
                    <span className="text-[10px] text-muted-foreground">{(a.confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="border-t pt-3 space-y-3">
            <div>
              <label className="text-xs font-medium">审核意见（选填）</label>
              <textarea
                className="mt-1 w-full rounded-md border px-2 py-1.5 text-xs resize-none"
                rows={3}
                placeholder="退回/通过备注..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={actionLoading}
                onClick={handleApprove}
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                {actionLoading ? "处理中..." : "通过"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={actionLoading || !reason.trim()}
                onClick={handleReject}
              >
                <XCircle className="mr-1 h-4 w-4" />
                退回
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
