import api from "./api";

export async function getAnnotations(imageId: string) {
  const r = await api.get("/annotations", { params: { image_id: imageId } });
  return r.data;
}

export async function saveBatch(imageId: string, annotations: any[]) {
  const r = await api.post("/annotations/batch", annotations, { params: { image_id: imageId } });
  return r.data;
}

export async function getVersions(annotationId: string) {
  const r = await api.get(`/annotations/${annotationId}/versions`);
  return r.data;
}
