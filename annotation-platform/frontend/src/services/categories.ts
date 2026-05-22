import api from "./api";

export async function getCategoryTree(projectId: string) {
  const r = await api.get("/categories/tree", { params: { project_id: projectId } });
  return r.data;
}

export async function getCategories(projectId: string) {
  const r = await api.get("/categories", { params: { project_id: projectId } });
  return r.data;
}

export async function createCategory(projectId: string, data: any) {
  const r = await api.post("/categories", data, { params: { project_id: projectId } });
  return r.data;
}

export async function updateCategory(id: string, data: any) {
  const r = await api.put(`/categories/${id}`, data);
  return r.data;
}
