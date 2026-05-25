import api from "./api";

export async function getImages(projectId: string, params?: Record<string, any>) {
  const response = await api.get("/images", { params: { project_id: projectId, ...params } });
  return response.data;
}

export async function uploadImages(projectId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const response = await api.post("/images/upload", formData, {
    params: { project_id: projectId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function getImageDetail(imageId: string) {
  const response = await api.get(`/images/${imageId}`);
  return response.data;
}

export async function autoAnnotate(imageId: string, modelName = "yolov8n") {
  const response = await api.post(`/images/${imageId}/auto-annotate`, null, {
    params: { model_name: modelName },
  });
  return response.data;
}

export async function submitReview(imageId: string) {
  const response = await api.post(`/images/${imageId}/submit-review`);
  return response.data;
}

export async function deleteImage(imageId: string) {
  const response = await api.delete(`/images/${imageId}`);
  return response.data;
}

export async function restoreImage(imageId: string) {
  const response = await api.post(`/images/${imageId}/restore`);
  return response.data;
}

export async function permanentDeleteImage(imageId: string) {
  const response = await api.delete(`/images/${imageId}/permanent`);
  return response.data;
}

export async function getTrashImages(projectId: string, params?: Record<string, any>) {
  const response = await api.get("/images/trash/list", { params: { project_id: projectId, ...params } });
  return response.data;
}

export async function toggleSensitive(imageId: string, isSensitive: boolean, note?: string) {
  const response = await api.patch(`/images/${imageId}/sensitive`, null, {
    params: { is_sensitive: isSensitive, sensitive_note: note },
  });
  return response.data;
}

// ── Review APIs ──

export async function getReviewQueue(projectId: string, params?: Record<string, any>) {
  const response = await api.get("/reviews/queue", { params: { project_id: projectId, ...params } });
  return response.data;
}

export async function claimReview(imageId: string) {
  const response = await api.post(`/reviews/${imageId}/claim`);
  return response.data;
}

export async function releaseReview(imageId: string) {
  const response = await api.post(`/reviews/${imageId}/release`);
  return response.data;
}

export async function approveReview(imageId: string, reason?: string) {
  const response = await api.post(`/reviews/${imageId}/approve`, { reason });
  return response.data;
}

export async function rejectReview(imageId: string, reason?: string) {
  const response = await api.post(`/reviews/${imageId}/reject`, { reason });
  return response.data;
}
