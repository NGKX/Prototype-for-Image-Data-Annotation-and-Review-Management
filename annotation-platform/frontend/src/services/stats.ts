import api from "./api";

export async function getDashboardStats(projectId: string) {
  const r = await api.get("/stats/dashboard", { params: { project_id: projectId } });
  return r.data;
}

export async function getAnnotatorStats(projectId: string) {
  const r = await api.get("/stats/annotators", { params: { project_id: projectId } });
  return r.data;
}

export async function getTrendStats(projectId: string, days = 30) {
  const r = await api.get("/stats/trends", { params: { project_id: projectId, days } });
  return r.data;
}

export async function getCategoryStats(projectId: string) {
  const r = await api.get("/stats/categories", { params: { project_id: projectId } });
  return r.data;
}
