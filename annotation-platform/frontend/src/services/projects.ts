import api from "./api";
import type { Project } from "@/types/project";
import type { PaginatedResponse } from "@/types/api";

export async function getProjects(page = 1, pageSize = 20): Promise<PaginatedResponse<Project>> {
  const response = await api.get<PaginatedResponse<Project>>("/projects", {
    params: { page, page_size: pageSize },
  });
  return response.data;
}

export async function createProject(data: { name: string; description?: string }): Promise<Project> {
  const response = await api.post<Project>("/projects", data);
  return response.data;
}

export async function getProject(id: string): Promise<Project> {
  const response = await api.get<Project>(`/projects/${id}`);
  return response.data;
}

export async function joinProject(projectId: string) {
  const r = await api.post(`/projects/${projectId}/join`);
  return r.data;
}

export async function leaveProject(projectId: string) {
  const r = await api.post(`/projects/${projectId}/leave`);
  return r.data;
}

export async function checkMembership(projectId: string) {
  const r = await api.get(`/projects/${projectId}/is-member`);
  return r.data;
}

export async function deleteProject(projectId: string) {
  const r = await api.delete(`/projects/${projectId}`);
  return r.data;
}
