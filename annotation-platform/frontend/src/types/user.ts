export type Role = "admin" | "data_manager" | "reviewer" | "annotator";

export interface User {
  id: string;
  username: string;
  role: Role;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}
