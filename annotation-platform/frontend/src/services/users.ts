import api from "./api";

export async function listUsers(page = 1, pageSize = 50) {
  const r = await api.get("/users", { params: { page, page_size: pageSize } });
  return r.data;
}

export async function createUser(data: { username: string; password: string; role: string; display_name?: string }) {
  const r = await api.post("/users", data);
  return r.data;
}

export async function updateUser(userId: string, params: { role?: string; is_active?: boolean }) {
  const r = await api.patch(`/users/${userId}`, null, { params });
  return r.data;
}

export async function deleteUser(userId: string) {
  const r = await api.delete(`/users/${userId}`);
  return r.data;
}
