import api from "./api";

export async function listExports(projectId: string, params?: Record<string, any>) {
  const r = await api.get("/exports", { params: { project_id: projectId, ...params } });
  return r.data;
}

export async function createExport(projectId: string, exportFormat: string, filterCriteria?: Record<string, any>) {
  const r = await api.post("/exports", { export_format: exportFormat, filter_criteria: filterCriteria }, {
    params: { project_id: projectId },
  });
  return r.data;
}

export async function getExportStatus(exportId: string) {
  const r = await api.get(`/exports/${exportId}`);
  return r.data;
}

export function getExportDownloadUrl(exportId: string) {
  const base = api.defaults.baseURL || "/api/v1";
  const token = localStorage.getItem("token");
  return `${base}/exports/${exportId}/download?token=${encodeURIComponent(token || "")}`;
}

export async function deleteExport(exportId: string) {
  const r = await api.delete(`/exports/${exportId}`);
  return r.data;
}
