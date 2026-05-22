import { create } from "zustand";

export interface AnnotationItem {
  id: string;
  type: string;
  geometry: any;
  categoryId: string | null;
  categoryName?: string;
  categoryColor?: string;
  isAuto: boolean;
  confidence?: number;
  version: number;
  _tempId?: string;
}

interface AnnotationState {
  annotations: AnnotationItem[];
  selectedId: string | null;
  activeTool: string; // "select" | "bbox" | "polygon" | "point" | "line" | "circle" | "segmentation"
  activeCategoryId: string | null;
  isDirty: boolean;
  undoStack: { annotations: AnnotationItem[] }[];
  redoStack: { annotations: AnnotationItem[] }[];
  zoomLevel: number;
  imageMeta: { width: number; height: number } | null;

  setAnnotations: (items: AnnotationItem[]) => void;
  setSelectedId: (id: string | null) => void;
  setActiveTool: (tool: string) => void;
  setActiveCategory: (id: string | null) => void;
  setDirty: (dirty: boolean) => void;
  setImageMeta: (meta: { width: number; height: number }) => void;
  setZoomLevel: (z: number) => void;

  addAnnotation: (item: AnnotationItem) => void;
  updateAnnotation: (id: string, geometry: any) => void;
  deleteAnnotation: (id: string) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export const useAnnotationStore = create<AnnotationState>((set, get) => ({
  annotations: [],
  selectedId: null,
  activeTool: "select",
  activeCategoryId: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],
  zoomLevel: 1,
  imageMeta: null,

  setAnnotations: (items) => set({ annotations: items }),
  setSelectedId: (id) => set({ selectedId: id }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveCategory: (id) => set({ activeCategoryId: id }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setImageMeta: (meta) => set({ imageMeta: meta }),
  setZoomLevel: (z) => set({ zoomLevel: z }),

  addAnnotation: (item) => {
    get().pushUndo();
    set((s) => ({ annotations: [...s.annotations, item], isDirty: true }));
  },

  updateAnnotation: (id, geometry) => {
    get().pushUndo();
    set((s) => ({
      annotations: s.annotations.map((a) => a.id === id ? { ...a, geometry } : a),
      isDirty: true,
    }));
  },

  deleteAnnotation: (id) => {
    get().pushUndo();
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      isDirty: true,
    }));
  },

  pushUndo: () => {
    const { annotations, undoStack } = get();
    const snapshot = JSON.parse(JSON.stringify(annotations));
    set({ undoStack: [...undoStack.slice(-49), { annotations: snapshot }] });
  },

  undo: () => {
    const { undoStack, annotations, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    const currentSnapshot = JSON.parse(JSON.stringify(annotations));
    set({
      annotations: prev.annotations,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack.slice(-49), { annotations: currentSnapshot }],
      isDirty: true,
    });
  },

  redo: () => {
    const { redoStack, annotations, undoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const currentSnapshot = JSON.parse(JSON.stringify(annotations));
    set({
      annotations: next.annotations,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack.slice(-49), { annotations: currentSnapshot }],
      isDirty: true,
    });
  },

  reset: () => set({
    annotations: [], selectedId: null, activeTool: "select",
    activeCategoryId: null, isDirty: false,
    undoStack: [], redoStack: [], zoomLevel: 1,
  }),
}));
