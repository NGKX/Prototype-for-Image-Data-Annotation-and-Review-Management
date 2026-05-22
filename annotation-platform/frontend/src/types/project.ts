export interface Project {
  id: string;
  name: string;
  description?: string;
  status: "active" | "archived";
  created_by?: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  annotated_count: number;
  approved_count: number;
}
