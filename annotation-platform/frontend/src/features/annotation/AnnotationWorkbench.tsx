import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAnnotationStore } from "./store";
import { getAnnotations, saveBatch } from "@/services/annotations";
import { getImageDetail } from "@/services/images";
import { getCategories } from "@/services/categories";
import api from "@/services/api";
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
  const [submitting, setSubmitting] = useState(false);
  const [imgName, setImgName] = useState("");

  useEffect(() => {
    if (!iid) return;
    store.reset();
    getImageDetail(iid).then((img: any) => {
      setImageUrl(img.presigned_url);
      setImgName(img.original_name || "");
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

  useEffect(() => {
    const state = useAnnotationStore.getState();
    if (state.selectedId && state.activeCategoryId) {
      const cat = categories.find((c: any) => c.id === state.activeCategoryId);
      if (!cat) return;
      const a = state.annotations.find((x) => x.id === state.selectedId);
      if (!a || a.categoryId === cat.id) return;
      const updated = { ...a, categoryId: cat.id, categoryColor: cat.color, categoryName: cat.name };
      const idx = state.annotations.findIndex((x) => x.id === a.id);
      const newList = [...state.annotations];
      newList[idx] = updated;
      state.setAnnotations(newList);
      state.setDirty(true);
      const canvas = canvasRef.current?.getCanvas();
      if (canvas) {
        canvas.getObjects().forEach((o: any) => {
          if (o._aid === a.id) {
            o.set({ fill: `${cat.color}22`, stroke: cat.color });
            canvas.renderAll();
          }
        });
      }
      state.setActiveCategory(null);
    }
  }, [store.selectedId, store.activeCategoryId, categories]);

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

  async function handleSubmitReview() {
    if (!iid) return;
    setSubmitting(true);
    try {
      await handleSave();
      await api.post(`/images/${iid}/submit-review`);
      store.setDirty(false);
      navigate(`/projects/${pid}/images`);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  }

  function removeCanvasObject(aid: string) {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    canvas.getObjects().forEach((o: any) => { if (o._aid === aid) canvas.remove(o); });
    canvas.renderAll();
  }

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
          removeCanvasObject(store.selectedId);
          store.deleteAnnotation(store.selectedId);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  return (
    <div className="flex h-screen flex-col bg-[#1d1d1f] overflow-hidden">
      {/* Top bar — frosted */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 backdrop-blur-md border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/projects/${pid}/images`)}
            className="text-xs text-white/60 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> 返回
          </button>
          <span className="text-xs text-white/40">|</span>
          <span className="text-xs text-white/80 font-medium">{imgName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">{store.annotations.length} 个标注</span>
          {store.isDirty && <Badge variant="warning" className="text-[10px]">未保存</Badge>}
          <div className="w-px h-5 bg-white/10 mx-1" />
          <div className="flex items-center gap-1">
            <button onClick={() => store.undo()} disabled={store.undoStack.length === 0}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-30">
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => store.redo()} disabled={store.redoStack.length === 0}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-30">
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <span className="text-xs text-white/40">{Math.round(store.zoomLevel * 100)}%</span>
          <button onClick={() => canvasRef.current?.zoomOut()}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
            <Minus className="h-3 w-3" />
          </button>
          <button onClick={() => canvasRef.current?.zoomIn()}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
            <Plus className="h-3 w-3" />
          </button>
          <button onClick={() => canvasRef.current?.fitToScreen()}
            className="p-1 rounded text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors">
            <Maximize className="h-3 w-3" />
          </button>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <button onClick={handleSave} disabled={saving || !store.isDirty}
            className="text-xs text-white/60 hover:text-white transition-colors disabled:opacity-30 flex items-center gap-1">
            <Save className="h-3.5 w-3.5" /> {saving ? "..." : "保存"}
          </button>
          <button onClick={handleSubmitReview} disabled={submitting || store.annotations.length === 0}
            className="text-xs px-3 py-1.5 rounded-full bg-[#2997ff] text-white font-medium hover:bg-[#0071e3] transition-colors disabled:opacity-50 flex items-center gap-1">
            <Send className="h-3 w-3" /> 提交审核
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left tools */}
        <div className="w-12 flex flex-col items-center gap-0.5 py-3 border-r border-white/10 bg-white/[0.02] flex-shrink-0">
          <ToolBtn icon={<MousePointer2 className="h-4 w-4" />} label="选择" active={store.activeTool === "select"} onClick={() => store.setActiveTool("select")} />
          <ToolBtn icon={<Square className="h-4 w-4" />} label="矩形" active={store.activeTool === "bbox"} onClick={() => store.setActiveTool("bbox")} />
          <ToolBtn icon={<Pentagon className="h-4 w-4" />} label="多边形" active={store.activeTool === "polygon"} onClick={() => store.setActiveTool("polygon")} />
        </div>

        {/* Center canvas */}
        <div className="flex-1 overflow-hidden p-4">
          {imageUrl ? (
            <AnnotationCanvas ref={canvasRef} imageUrl={imageUrl} />
          ) : (
            <div className="flex h-full items-center justify-center text-white/30 text-sm">加载图片中...</div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-56 bg-[#f5f5f7] flex flex-col border-l border-black/5 overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-black/5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-3">标签选择</h4>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c: any) => (
                <button key={c.id}
                  onClick={() => store.setActiveCategory(store.activeCategoryId === c.id ? null : c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs border transition-all ${
                    store.activeCategoryId === c.id
                      ? "border-[#0066cc] text-[#0066cc] bg-blue-50 shadow-sm"
                      : "border-[#e5e5e7] text-[#333] bg-white hover:border-[#0066cc]"
                  }`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                  {c.shortcut_key && <span className="text-[10px] text-[#86868b]">{c.shortcut_key}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 flex-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b] mb-3">标注列表</h4>
            {store.annotations.length === 0 ? (
              <p className="text-xs text-[#86868b]">暂未标注</p>
            ) : (
              <div className="space-y-1.5">
                {store.annotations.map((a) => (
                  <div key={a.id}
                    onClick={() => store.setSelectedId(a.id)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs cursor-pointer transition-all ${
                      store.selectedId === a.id ? "bg-white shadow-sm border border-[#0066cc] text-[#0066cc]" : "hover:bg-white/60 text-[#333]"
                    }`}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.categoryColor || "#999" }} />
                    <span className="flex-1 truncate font-medium">{a.categoryName || a.type}</span>
                    {a.isAuto && <Badge variant="outline" className="text-[10px]">auto</Badge>}
                    <button className="text-[#86868b] hover:text-red-500 transition-colors ml-auto"
                      onClick={(e) => { e.stopPropagation(); removeCanvasObject(a.id); store.deleteAnnotation(a.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 bg-[#f5f5f7] border-t border-black/5 text-[10px] text-[#86868b] text-center">
            请确保数据已脱敏处理
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-xl p-2 w-10 text-[10px] transition-colors ${
        active ? "bg-white/10 text-[#2997ff]" : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
      }`}
      title={label}>
      {icon}
    </button>
  );
}
