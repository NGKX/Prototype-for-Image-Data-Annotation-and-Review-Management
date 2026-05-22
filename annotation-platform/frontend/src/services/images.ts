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
