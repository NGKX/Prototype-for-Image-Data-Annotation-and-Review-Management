import api from "./api";
import type { LoginRequest, TokenResponse, User } from "@/types/user";

export async function login(body: LoginRequest): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/auth/login", body);
  return response.data;
}

export async function register(body: {
  username: string;
  password: string;
  role?: string;
  display_name?: string;
  email?: string;
}): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>("/auth/register", body);
  return response.data;
}

export async function getMe(): Promise<User> {
  const response = await api.get<User>("/auth/me");
  return response.data;
}
