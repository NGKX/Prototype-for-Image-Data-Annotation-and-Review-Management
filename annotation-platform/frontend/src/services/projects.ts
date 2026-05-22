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
