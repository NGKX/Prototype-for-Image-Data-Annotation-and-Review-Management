import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function TrashPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">回收站</h1>
      <Card>
        <CardHeader>
          <CardTitle>已删除的图片</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Phase 6 将实现软删除和回收站功能</p>
        </CardContent>
      </Card>
    </div>
  );
}
