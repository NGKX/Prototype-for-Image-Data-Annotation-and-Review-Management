import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function StatsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">人员统计</h1>
      <Card>
        <CardHeader>
          <CardTitle>标注员表现</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Phase 8 将实现标注员准确率统计和趋势图</p>
        </CardContent>
      </Card>
    </div>
  );
}
