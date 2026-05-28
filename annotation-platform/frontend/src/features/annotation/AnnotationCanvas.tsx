import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Canvas, Rect, Polygon, Polyline, Circle, FabricImage, Point } from "fabric";
import { useAnnotationStore } from "./store";
import { canvasToImage, roundCoords } from "./utils/coordinates";

interface Props {
  imageUrl: string;
  onReady?: () => void;
}

export interface AnnotationCanvasHandle {
  getCanvas: () => Canvas | null;
  fitToScreen: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(({ imageUrl, onReady }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { activeTool, activeCategoryId, selectedId, annotations, setSelectedId, addAnnotation, setZoomLevel } = useAnnotationStore();

  const initCanvas = useCallback(async () => {
    if (!canvasRef.current || fabricRef.current) return;
    const wrapper = containerRef.current;
    if (!wrapper) return;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    const el = canvasRef.current;
    el.width = width;
    el.height = height;
    const canvas = new Canvas(el, {
      width, height,
      backgroundColor: "#1a1a2e",
      selection: false,
    });
    fabricRef.current = canvas;

    try {
      const img = await FabricImage.fromURL(imageUrl, { crossOrigin: "anonymous" });
      if (!img.width || !img.height) return;

      // Make image fill as much canvas as possible and be non-interactive
      const scale = Math.min(width / img.width, height / img.height) * 0.95;
      img.set({
        left: (width - img.width * scale) / 2,
        top: (height - img.height * scale) / 2,
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        hasControls: false,
        lockMovementX: true,
        lockMovementY: true,
      });
      canvas.add(img);
      // Send image to back so annotations draw on top
      canvas.sendObjectToBack(img);
      canvas.renderAll();
      setZoomLevel(scale);
      useAnnotationStore.getState().setImageMeta({ width: img.width, height: img.height });
      onReady?.();
    } catch (e) {
      console.error("Failed to load image:", e);
    }

    // Zoom
    canvas.on("mouse:wheel" as any, (opt: any) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(10, Math.max(0.05, zoom));
      const point = new Point(opt.e.offsetX, opt.e.offsetY);
      canvas.zoomToPoint(point, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
      setZoomLevel(zoom);
      canvas.renderAll();
    });

    // Pan: middle mouse button OR space+left-drag (in select mode)
    let isPanning = false;
    let spaceDown = false;

    window.addEventListener("keydown", (e) => { if (e.code === "Space") { spaceDown = true; e.preventDefault(); } });
    window.addEventListener("keyup", (e) => { if (e.code === "Space") { spaceDown = false; } });

    canvas.on("mouse:down", (opt: any) => {
      const store = useAnnotationStore.getState();
      // Pan on middle click, OR space+drag in select mode, OR left click in select mode
      if (opt.e.button === 1 || (spaceDown && opt.e.button === 0)) {
        isPanning = true;
        canvas.selection = false;
        canvas.defaultCursor = "grab";
        return;
      }
      // In select mode, allow panning by dragging empty space (not on objects)
      if (store.activeTool === "select" && opt.e.button === 0 && !opt.target) {
        isPanning = true;
        canvas.defaultCursor = "grabbing";
      }
    });
    canvas.on("mouse:move", (opt: any) => {
      if (isPanning) {
        const vpt = canvas.viewportTransform!;
        vpt[4] += opt.e.movementX || 0;
        vpt[5] += opt.e.movementY || 0;
        canvas.requestRenderAll();
      }
    });
    canvas.on("mouse:up", () => {
      isPanning = false;
      canvas.defaultCursor = "default";
    });
  }, [imageUrl, setZoomLevel, onReady]);

  // BBox drawing
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;

    let isDrawing = false;
    let startX = 0, startY = 0;
    let tempRect: Rect | null = null;

    const onMouseDown = (opt: any) => {
      if (activeTool !== "bbox" || opt.e.button !== 0) return;
      const pt = canvasToImage(fabric, { x: opt.scenePoint.x, y: opt.scenePoint.y });
      startX = pt.x; startY = pt.y;
      isDrawing = true;
      tempRect = new Rect({
        left: opt.scenePoint.x, top: opt.scenePoint.y,
        width: 1, height: 1, fill: "transparent",
        stroke: "#3388FF", strokeWidth: 2 / fabric.getZoom(),
        strokeDashArray: [5, 5],
      });
      fabric.add(tempRect);
    };

    const onMouseMove = (opt: any) => {
      if (!isDrawing || !tempRect) return;
      const pt = opt.scenePoint;
      const vpt = fabric.viewportTransform!;
      const left = Math.min(startX * fabric.getZoom() + vpt[4], pt.x);
      const top = Math.min(startY * fabric.getZoom() + vpt[5], pt.y);
      const w = Math.abs(pt.x - (startX * fabric.getZoom() + vpt[4]));
      const h = Math.abs(pt.y - (startY * fabric.getZoom() + vpt[5]));
      tempRect.set({ left, top, width: w, height: h });
      fabric.renderAll();
    };

    const onMouseUp = (opt: any) => {
      if (!isDrawing || !tempRect) return;
      isDrawing = false;
      const endPt = canvasToImage(fabric, { x: opt.scenePoint.x, y: opt.scenePoint.y });
      const imgX = Math.min(startX, endPt.x);
      const imgY = Math.min(startY, endPt.y);
      const imgW = Math.abs(endPt.x - startX);
      const imgH = Math.abs(endPt.y - startY);
      fabric.remove(tempRect);
      tempRect = null;
      if (imgW < 3 || imgH < 3) return;

      const g: any = roundCoords({ x: imgX, y: imgY, width: imgW, height: imgH });
      const id = crypto.randomUUID();
      addAnnotation({ id, type: "bbox", geometry: { x: g.x, y: g.y, width: g.width, height: g.height }, categoryId: activeCategoryId, isAuto: false, version: 1 });

      const r = new Rect({
        left: imgX * fabric.getZoom() + fabric.viewportTransform![4],
        top: imgY * fabric.getZoom() + fabric.viewportTransform![5],
        width: imgW * fabric.getZoom(), height: imgH * fabric.getZoom(),
        fill: "#3388FF22", stroke: "#3388FF",
        strokeWidth: 2 / fabric.getZoom(),
      });
      (r as any)._aid = id;
      r.on("selected", () => setSelectedId(id));
      fabric.add(r);
      fabric.renderAll();
    };

    fabric.on("mouse:down", onMouseDown);
    fabric.on("mouse:move", onMouseMove);
    fabric.on("mouse:up", onMouseUp);
    return () => {
      fabric.off("mouse:down", onMouseDown);
      fabric.off("mouse:move", onMouseMove);
      fabric.off("mouse:up", onMouseUp);
    };
  }, [activeTool, activeCategoryId, addAnnotation, setSelectedId]);

  // Polygon drawing
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;

    const polyPoints: { x: number; y: number }[] = [];
    let tempLine: Polyline | null = null;
    let vertexCircles: Circle[] = [];
    let lastClickTime = 0;

    const redrawTemp = () => {
      if (tempLine) fabric.remove(tempLine);
      vertexCircles.forEach((c) => fabric.remove(c));
      vertexCircles = [];
      if (polyPoints.length === 0) return;

      const zoom = fabric.getZoom();
      const vpt = fabric.viewportTransform!;
      const canvasPts = polyPoints.map((p) => ({ x: p.x * zoom + vpt[4], y: p.y * zoom + vpt[5] }));
      if (canvasPts.length === 1) {
        // Show a dot for single point
        const c = new Circle({ left: canvasPts[0].x - 3, top: canvasPts[0].y - 3, radius: 3, fill: "#3388FF", selectable: false, evented: false });
        vertexCircles.push(c);
        fabric.add(c);
        fabric.renderAll();
        return;
      }
      tempLine = new Polyline(canvasPts, { fill: "transparent", stroke: "#3388FF", strokeWidth: 2 / zoom, strokeDashArray: [5, 5], selectable: false, evented: false });
      fabric.add(tempLine);
      // Vertex handles
      canvasPts.forEach((pt) => {
        const c = new Circle({ left: pt.x - 4, top: pt.y - 4, radius: 4, fill: "#3388FF", stroke: "#fff", strokeWidth: 1, selectable: false, evented: false });
        vertexCircles.push(c);
        fabric.add(c);
      });
      fabric.renderAll();
    };

    const onMouseDown = (opt: any) => {
      if (activeTool !== "polygon" || opt.e.button !== 0) return;
      const now = Date.now();
      if (now - lastClickTime < 350 && polyPoints.length >= 3) {
        // Double click — close and save polygon
        const id = crypto.randomUUID();
        const points = polyPoints.map((p) => [roundCoords(p).x, roundCoords(p).y]);
        addAnnotation({ id, type: "polygon", geometry: { points, closed: true }, categoryId: activeCategoryId, isAuto: false, version: 1 });

        const zoom = fabric.getZoom();
        const vpt = fabric.viewportTransform!;
        const canvasPts = points.map(([x, y]: number[]) => ({ x: x * zoom + vpt[4], y: y * zoom + vpt[5] }));
        const poly = new Polygon(canvasPts, { fill: "#3388FF22", stroke: "#3388FF", strokeWidth: 2 / zoom, selectable: true });
        (poly as any)._aid = id;
        poly.on("selected", () => setSelectedId(id));
        fabric.add(poly);
        cancelDrawing();
        return;
      }
      lastClickTime = now;
      const pt = canvasToImage(fabric, { x: opt.scenePoint.x, y: opt.scenePoint.y });
      polyPoints.push(pt);
      redrawTemp();
    };

    const cancelDrawing = () => {
      if (tempLine) { fabric.remove(tempLine); tempLine = null; }
      vertexCircles.forEach((c) => fabric.remove(c));
      vertexCircles = [];
      polyPoints.length = 0;
      fabric.renderAll();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTool !== "polygon") return;
      if (e.key === "Enter" && polyPoints.length >= 3) {
        const id = crypto.randomUUID();
        const points = polyPoints.map((p) => [roundCoords(p).x, roundCoords(p).y]);
        addAnnotation({ id, type: "polygon", geometry: { points, closed: true }, categoryId: activeCategoryId, isAuto: false, version: 1 });
        const zoom = fabric.getZoom();
        const vpt = fabric.viewportTransform!;
        const canvasPts = points.map(([x, y]: number[]) => ({ x: x * zoom + vpt[4], y: y * zoom + vpt[5] }));
        const poly = new Polygon(canvasPts, { fill: "#3388FF22", stroke: "#3388FF", strokeWidth: 2 / zoom, selectable: true });
        (poly as any)._aid = id;
        poly.on("selected", () => setSelectedId(id));
        fabric.add(poly);
        cancelDrawing();
      }
      if (e.key === "Escape") cancelDrawing();
    };

    fabric.on("mouse:down", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      fabric.off("mouse:down", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      cancelDrawing();
    };
  }, [activeTool, activeCategoryId, addAnnotation, setSelectedId]);

  // Sync Fabric object changes back to store (resize/move)
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const handler = (opt: any) => {
      const st = useAnnotationStore.getState();
      const obj = opt.target;
      if (!obj || !(obj as any)._aid) return;
      const id = (obj as any)._aid;
      const a = st.annotations.find((x) => x.id === id);
      if (!a) return;
      const bounds = obj.getBoundingRect();
      const center = canvasToImage(fabric, { x: bounds.left, y: bounds.top });
      const br = canvasToImage(fabric, { x: bounds.left + bounds.width, y: bounds.top + bounds.height });
      // Auto-to-manual transition
      if (a.isAuto) {
        st.setAnnotations(st.annotations.map((x) => x.id === id ? { ...x, geometry: x.geometry, isAuto: false } : x));
        // Update visual
        obj.set({ stroke: obj.stroke === "#FF9800" ? (a.categoryColor || "#3388FF") : obj.stroke, strokeDashArray: [], fill: `${a.categoryColor || "#3388FF"}22` });
      }
      if (a.type === "bbox") {
        st.updateAnnotation(id, roundCoords({ x: center.x, y: center.y, width: br.x - center.x, height: br.y - center.y }));
      } else if (a.type === "polygon") {
        const pts: number[][] = [];
        if ((obj as any).points) {
          ((obj as any).points as any[]).forEach((p: any) => {
            const ip = canvasToImage(fabric, { x: (obj.left || 0) + p.x * (obj.scaleX || 1), y: (obj.top || 0) + p.y * (obj.scaleY || 1) });
            pts.push([roundCoords(ip).x, roundCoords(ip).y]);
          });
        }
        if (pts.length >= 3) st.updateAnnotation(id, { points: pts, closed: true });
      }
    };
    fabric.on("object:modified", handler);
    return () => { fabric.off("object:modified", handler); };
  }, []);

  // Render annotations
  useEffect(() => {
    const fabric = fabricRef.current;
    if (!fabric) return;
    const objs = fabric.getObjects();
    objs.forEach((o: any) => { if (o._aid) fabric.remove(o); });
    const zoom = fabric.getZoom();
    const vpt = fabric.viewportTransform!;

    annotations.forEach((a) => {
      if (a.type === "bbox") {
        const g = a.geometry;
        const color = a.categoryColor || "#3388FF";
        const autoStyle = a.isAuto ? {
          strokeDashArray: [6, 4],
          fill: `${color}11`,
          stroke: "#FF9800",
        } : {
          fill: `${color}22`,
          stroke: color,
        };
        const r = new Rect({
          left: g.x * zoom + vpt[4], top: g.y * zoom + vpt[5],
          width: (g.width || 0) * zoom, height: (g.height || 0) * zoom,
          strokeWidth: 2 / zoom, selectable: true,
          ...autoStyle,
        });
        (r as any)._aid = a.id;
        r.on("selected", () => setSelectedId(a.id));
        if (a.id === selectedId) { r.set({ strokeWidth: 3 / zoom }); fabric.setActiveObject(r); }
        fabric.add(r);
      }
      if (a.type === "polygon") {
        const points = a.geometry.points?.map((p: number[]) => ({ x: p[0] * zoom + vpt[4], y: p[1] * zoom + vpt[5] })) || [];
        if (points.length >= 3) {
          const poly = new Polygon(points, { fill: `${a.categoryColor || "#3388FF"}22`, stroke: a.categoryColor || "#3388FF", strokeWidth: 2 / zoom, selectable: true });
          (poly as any)._aid = a.id;
          poly.on("selected", () => setSelectedId(a.id));
          fabric.add(poly);
        }
      }
    });
    fabric.renderAll();
  }, [annotations, selectedId, setSelectedId]);

  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricRef.current,
    fitToScreen: () => { const c = fabricRef.current; if (c) { c.setZoom(1); c.viewportTransform = [1, 0, 0, 1, 0, 0]; c.renderAll(); setZoomLevel(1); } },
    zoomIn: () => { const c = fabricRef.current; if (c) { const z = Math.min(10, c.getZoom() * 1.2); c.setZoom(z); c.renderAll(); setZoomLevel(z); } },
    zoomOut: () => { const c = fabricRef.current; if (c) { const z = Math.max(0.05, c.getZoom() / 1.2); c.setZoom(z); c.renderAll(); setZoomLevel(z); } },
  }));

  useEffect(() => { initCanvas(); return () => { fabricRef.current?.dispose(); fabricRef.current = null; }; }, [initCanvas]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
});

AnnotationCanvas.displayName = "AnnotationCanvas";
export default AnnotationCanvas;
