import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ImageListPage() {
  const { pid } = useParams();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">图片列表</h1>
      <p className="text-sm text-muted-foreground">项目 ID: {pid}</p>
      <Card>
        <CardHeader>
          <CardTitle>图片库</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Phase 2 将实现图片上传、缩略图网格和筛选功能</p>
        </CardContent>
      </Card>
    </div>
  );
}
