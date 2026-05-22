import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ProjectListPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">项目管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Phase 2 将实现项目创建与展示</p>
        </CardContent>
      </Card>
    </div>
  );
}
