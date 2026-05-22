// Canvas <-> Image coordinate transforms

import type { Canvas } from "fabric";

export function getViewportTransform(canvas: Canvas): number[] {
  return canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
}

export function getZoom(canvas: Canvas): number {
  return canvas.getZoom();
}

export function getPanOffset(canvas: Canvas): { x: number; y: number } {
  const vpt = getViewportTransform(canvas);
  return { x: vpt[4], y: vpt[5] };
}

export function canvasToImage(canvas: Canvas, point: { x: number; y: number }): { x: number; y: number } {
  const zoom = getZoom(canvas);
  const pan = getPanOffset(canvas);
  return {
    x: (point.x - pan.x) / zoom,
    y: (point.y - pan.y) / zoom,
  };
}

export function imageToCanvas(canvas: Canvas, point: { x: number; y: number }): { x: number; y: number } {
  const zoom = getZoom(canvas);
  const pan = getPanOffset(canvas);
  return {
    x: point.x * zoom + pan.x,
    y: point.y * zoom + pan.y,
  };
}

export function roundCoords<T extends { x: number; y: number }>(point: T, decimals = 2): T {
  return {
    ...point,
    x: Math.round(point.x * Math.pow(10, decimals)) / Math.pow(10, decimals),
    y: Math.round(point.y * Math.pow(10, decimals)) / Math.pow(10, decimals),
  };
}
