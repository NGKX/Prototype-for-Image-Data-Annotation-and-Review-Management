export type AnnotationStatus = "unannotated" | "annotating" | "annotated" | "under_review";
export type ReviewStatus = "pending" | "pre_approved" | "approved" | "rejected" | "rework";

export interface Image {
  id: string;
  project_id: string;
  original_name: string;
  storage_key: string;
  thumbnail_key?: string;
  width?: number;
  height?: number;
  file_size?: number;
  mime_type: string;
  annotation_status: AnnotationStatus;
  review_status: ReviewStatus;
  is_sensitive?: boolean;
  sensitive_note?: string;
  uploaded_by?: string;
  thumbnail_url?: string;
  presigned_url?: string;
  created_at: string;
  updated_at: string;
}
