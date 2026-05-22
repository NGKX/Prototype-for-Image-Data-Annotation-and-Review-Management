import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnnotationStore } from "./store";
import { getAnnotations, saveBatch } from "@/services/annotations";
import { getImageDetail } from "@/services/images";
import { getCategories } from "@/services/categories";
import AnnotationCanvas, { type AnnotationCanvasHandle } from "./AnnotationCanvas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Square, Pentagon, MousePointer2, Plus, Minus, Maximize,
  Save, Send, Undo2, Redo2, Trash2, ArrowLeft,
} from "lucide-react";

export default function AnnotationWorkbench() {
  const { pid, iid } = useParams<{ pid: string; iid: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<AnnotationCanvasHandle>(null);
  const store = useAnnotationStore();

  const [imageUrl, setImageUrl] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!iid) return;
    store.reset();
    getImageDetail(iid).then((img: any) => {
      setImageUrl(img.presigned_url);
      useAnnotationStore.getState().setImageMeta({ width: img.width, height: img.height });
    });
    getAnnotations(iid).then((data: any) => {
      store.setAnnotations((data.items || []).map((a: any) => ({
        id: a.id, type: a.type, geometry: a.geometry,
        categoryId: a.category_id, categoryName: a.category_name,
        categoryColor: a.category_color, isAuto: a.is_auto,
        confidence: a.confidence, version: a.version,
      })));
    });
    if (pid) {
      getCategories(pid).then((data: any) => {
        setCategories(data.items || []);
      });
    }
  }, [iid, pid]);

  async function handleSave() {
    if (!iid) return;
    setSaving(true);
    try {
      const items = store.annotations.map((a) => ({
        type: a.type, geometry: a.geometry, category_id: a.categoryId,
      }));
      await saveBatch(iid, items);
      store.setDirty(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); store.undo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); store.redo(); }
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); handleSave(); }
      if (e.key === "b" && !e.ctrlKey) store.setActiveTool("bbox");
      if (e.key === "p" && !e.ctrlKey) store.setActiveTool("polygon");
      if (e.key === "v" && !e.ctrlKey) store.setActiveTool("select");
      if (e.key === "Delete" || e.key === "Backspace") {
        if (store.selectedId) {
          canvasRef.current?.getCanvas()?.getObjects().forEach((o: any) => {
            if (o.data?.annotationId === store.selectedId) canvasRef.current?.getCanvas()?.remove(o);
          });
          store.deleteAnnotation(store.selectedId);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  const toolBtn = (tool: string, icon: React.ReactNode, label: string) => (
    <button
      className={`flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs transition-colors ${store.activeTool === tool ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-gray-100"}`}
      onClick={() => store.setActiveTool(tool)}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen flex-col gap-0 bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b p-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${pid}/images`)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> 返回
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => store.undo()} disabled={store.undoStack.length === 0}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => store.redo()} disabled={store.redoStack.length === 0}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">缩放: {Math.round(store.zoomLevel * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !store.isDirty}>
            <Save className="mr-1 h-4 w-4" /> {saving ? "保存中..." : "保存"}
          </Button>
          {store.isDirty && <Badge variant="warning">未保存</Badge>}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tools + Categories */}
        <div className="flex w-14 flex-col items-center gap-1 border-r py-2">
          {toolBtn("select", <MousePointer2 className="h-4 w-4" />, "选择")}
          {toolBtn("bbox", <Square className="h-4 w-4" />, "矩形")}
          {toolBtn("polygon", <Pentagon className="h-4 w-4" />, "多边形")}
          <div className="my-2 w-8 border-t" />
          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs text-muted-foreground hover:bg-gray-100"
            onClick={() => canvasRef.current?.zoomIn()} title="放大">
            <Plus className="h-4 w-4" /><span>放大</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs text-muted-foreground hover:bg-gray-100"
            onClick={() => canvasRef.current?.zoomOut()} title="缩小">
            <Minus className="h-4 w-4" /><span>缩小</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 rounded-lg p-2 text-xs text-muted-foreground hover:bg-gray-100"
            onClick={() => canvasRef.current?.fitToScreen()} title="适应">
            <Maximize className="h-4 w-4" /><span>适应</span>
          </button>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-hidden">
          {imageUrl ? (
            <AnnotationCanvas ref={canvasRef} imageUrl={imageUrl} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">加载图片中...</div>
          )}
        </div>

        {/* Right: Categories + Annotation list */}
        <div className="w-52 border-l p-3">
          <h4 className="mb-2 text-sm font-semibold">类别</h4>
          <div className="mb-4 space-y-1">
            {categories.map((c: any) => (
              <button
                key={c.id}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors ${store.activeCategoryId === c.id ? "bg-primary/10 font-medium" : "hover:bg-gray-100"}`}
                onClick={() => store.setActiveCategory(store.activeCategoryId === c.id ? null : c.id)}
              >
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="flex-1 truncate text-left">{c.name}</span>
                {c.shortcut_key && <span className="text-muted-foreground">{c.shortcut_key}</span>}
              </button>
            ))}
          </div>

          <h4 className="mb-2 text-sm font-semibold">标注列表</h4>
          <div className="space-y-1">
            {store.annotations.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂未标注</p>
            ) : (
              store.annotations.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-2 rounded px-2 py-1 text-xs cursor-pointer ${store.selectedId === a.id ? "bg-blue-50" : "hover:bg-gray-100"}`}
                  onClick={() => store.setSelectedId(a.id)}
                >
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.categoryColor || "#999" }} />
                  <span className="flex-1 truncate">{a.categoryName || a.type}</span>
                  {a.isAuto && <Badge variant="outline" className="text-[10px]">auto</Badge>}
                  <button className="text-red-400 hover:text-red-600" onClick={(e) => {
                    e.stopPropagation();
                    canvasRef.current?.getCanvas()?.getObjects().forEach((o: any) => {
                      if (o.data?.annotationId === a.id) canvasRef.current?.getCanvas()?.remove(o);
                    });
                    store.deleteAnnotation(a.id);
                  }}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
