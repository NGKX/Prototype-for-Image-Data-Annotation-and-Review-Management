import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">数据导出</h1>
      <Card>
        <CardHeader>
          <CardTitle>导出配置</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Phase 7 将实现 YOLO/COCO/VOC 格式导出</p>
        </CardContent>
      </Card>
    </div>
  );
}
