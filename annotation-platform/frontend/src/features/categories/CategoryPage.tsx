import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CategoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">类别管理</h1>
      <Card>
        <CardHeader>
          <CardTitle>标签体系</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Phase 3 将实现层级类别树和编辑功能</p>
        </CardContent>
      </Card>
    </div>
  );
}
