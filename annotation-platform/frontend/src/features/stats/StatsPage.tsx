import { useEffect, useState, useCallback } from "react";
import { getProjects } from "@/services/projects";
import { getDashboardStats, getAnnotatorStats, getTrendStats, getCategoryStats } from "@/services/stats";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, CheckCircle, XCircle, Clock, BarChart3, TrendingUp, Tag } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import type { Project } from "@/types/project";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function StatsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedPid, setSelectedPid] = useState("");
  const [dashboard, setDashboard] = useState<any>(null);
  const [annotators, setAnnotators] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getProjects(1, 100).then((d) => setProjects(d.items || []));
  }, []);

  const load = useCallback(async () => {
    if (!selectedPid) return;
    setLoading(true);
    try {
      const [dash, anno, trend, cat] = await Promise.all([
        getDashboardStats(selectedPid),
        getAnnotatorStats(selectedPid),
        getTrendStats(selectedPid, 30),
        getCategoryStats(selectedPid),
      ]);
      setDashboard(dash);
      setAnnotators(anno.items || []);
      setTrends(trend.items || []);
      setCategories(cat.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedPid]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">人员统计</h1>
      </div>

      <div className="flex items-center gap-3">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <select className="rounded-md border px-3 py-2 text-sm min-w-[240px]" value={selectedPid}
          onChange={(e) => setSelectedPid(e.target.value)}>
          <option value="">-- 选择项目 --</option>
          {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>

      {!selectedPid ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <BarChart3 className="mb-2 h-12 w-12" />
          <p>请选择一个项目以查看统计数据</p>
        </div>
      ) : loading ? (
        <p className="py-10 text-center text-muted-foreground">加载中...</p>
      ) : (
        <>
          {/* Overview cards */}
          {dashboard && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">图片总数</p>
                  <p className="text-3xl font-bold">{dashboard.images?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    已标注 {dashboard.images?.annotated ?? 0} · 待标注 {dashboard.images?.unannotated ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">标注总数</p>
                  <p className="text-3xl font-bold">{dashboard.annotations?.total ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    自动 {dashboard.annotations?.auto ?? 0} · 手动 {dashboard.annotations?.manual ?? 0} · 均 {dashboard.annotations?.avg_per_image ?? 0}/图
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">审核通过率</p>
                  <p className="text-3xl font-bold text-green-600">{dashboard.reviews?.pass_rate ?? 0}%</p>
                  <div className="flex gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" />{dashboard.reviews?.approved ?? 0}</span>
                    <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="h-3 w-3" />{dashboard.reviews?.rejected ?? 0}</span>
                    <span className="flex items-center gap-1 text-xs text-yellow-500"><Clock className="h-3 w-3" />{dashboard.reviews?.pending ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">标注进度</p>
                  <div className="mt-2">
                    <div className="h-3 w-full rounded-full bg-gray-100">
                      <div className="h-3 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${dashboard.images?.total > 0 ? ((dashboard.images?.annotated ?? 0) / dashboard.images.total * 100).toFixed(0) : 0}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashboard.images?.total > 0 ? ((dashboard.images?.annotated ?? 0) / dashboard.images.total * 100).toFixed(0) : 0}% 完成
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Trends + Category Distribution */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* 30-day trend */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />30天趋势</CardTitle></CardHeader>
              <CardContent>
                {trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="annotations" stroke="#3b82f6" name="标注量" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="reviews" stroke="#22c55e" name="审核量" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-10 text-center text-muted-foreground text-sm">暂无趋势数据</p>
                )}
              </CardContent>
            </Card>

            {/* Category distribution */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Tag className="h-4 w-4" />类别分布</CardTitle></CardHeader>
              <CardContent>
                {categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={categories} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {categories.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-10 text-center text-muted-foreground text-sm">暂无类别数据</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Annotator table + chart */}
          <Card>
            <CardHeader><CardTitle>标注员表现</CardTitle></CardHeader>
            <CardContent>
              {annotators.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={annotators.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="display_name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="approved" stackId="a" fill="#22c55e" name="通过" />
                      <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="退回" />
                      <Bar dataKey="auto_count" stackId="a" fill="#f59e0b" name="自动标注" />
                      <Bar dataKey="manual_count" stackId="a" fill="#3b82f6" name="手动标注" />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 px-2">标注员</th>
                          <th className="py-2 px-2 text-right">总数</th>
                          <th className="py-2 px-2 text-right">自动</th>
                          <th className="py-2 px-2 text-right">手动</th>
                          <th className="py-2 px-2 text-right">通过</th>
                          <th className="py-2 px-2 text-right">退回</th>
                          <th className="py-2 px-2 text-right">准确率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {annotators.map((a) => (
                          <tr key={a.user_id} className="border-b last:border-0">
                            <td className="py-2 px-2 font-medium">{a.display_name}</td>
                            <td className="py-2 px-2 text-right">{a.total_annotations}</td>
                            <td className="py-2 px-2 text-right">{a.auto_count}</td>
                            <td className="py-2 px-2 text-right">{a.manual_count}</td>
                            <td className="py-2 px-2 text-right text-green-600">{a.approved}</td>
                            <td className="py-2 px-2 text-right text-red-500">{a.rejected}</td>
                            <td className="py-2 px-2 text-right">
                              <Badge variant={a.accuracy >= 80 ? "success" : a.accuracy >= 60 ? "secondary" : "destructive"} className="text-xs">
                                {a.accuracy}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-muted-foreground text-sm">暂无标注员数据</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
