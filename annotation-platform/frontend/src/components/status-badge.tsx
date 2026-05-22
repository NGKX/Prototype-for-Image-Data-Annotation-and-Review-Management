import { Badge } from "@/components/ui/badge";

const annotationStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "success" }> = {
  unannotated: { label: "未标注", variant: "secondary" },
  annotating: { label: "标注中", variant: "warning" },
  annotated: { label: "已标注", variant: "success" },
  under_review: { label: "审核中", variant: "warning" },
};

const reviewStatusMap: Record<string, { label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  pending: { label: "待审核", variant: "warning" },
  pre_approved: { label: "预通过", variant: "secondary" },
  approved: { label: "已通过", variant: "success" },
  rejected: { label: "已退回", variant: "destructive" },
  rework: { label: "待修改", variant: "warning" },
};

export function AnnotationStatusBadge({ status }: { status: string }) {
  const info = annotationStatusMap[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export function ReviewStatusBadge({ status }: { status: string }) {
  const info = reviewStatusMap[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const roleMap: Record<string, string> = {
    admin: "系统管理员",
    data_manager: "数据管理员",
    reviewer: "审核员",
    annotator: "标注员",
  };
  return <Badge variant="outline">{roleMap[role] || role}</Badge>;
}
