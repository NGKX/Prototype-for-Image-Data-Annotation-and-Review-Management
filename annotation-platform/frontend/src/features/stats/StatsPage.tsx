import { useEffect, useState, useCallback } from "react";
import { getProjects } from "@/services/projects";
import { getOverview, getDashboardStats, getMemberStats, getTrendStats, getCategoryStats } from "@/services/stats";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderOpen, CheckCircle, XCircle, BarChart3, TrendingUp, Tag,
  Image, Users, Upload, PenTool, Shield,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import type { Project } from "@/types/project";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function StatsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedPid, setSelectedPid] = useState("");
  const [overview, setOverview] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    getProjects(1, 100).then((d) => setProjects(d.items || []));
    getOverview().then((d) => { setOverview(d); setOverviewLoading(false); }).catch(() => setOverviewLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!selectedPid) { setDashboard(null); setMembers([]); setTrends([]); setCategories([]); return; }
    setLoading(true);
    try {
      const [dash, mem, trend, cat] = await Promise.all([
        getDashboardStats(selectedPid),
        getMemberStats(selectedPid),
        getTrendStats(selectedPid, 30),
        getCategoryStats(selectedPid),
      ]);
      setDashboard(dash);
      setMembers(mem.items || []);
      setTrends(trend.items || []);
      setCategories(cat.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [selectedPid]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">统计仪表盘</h1>

      {/* Global overview */}
      {!overviewLoading && overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <OverviewCard icon={<FolderOpen className="h-5 w-5 text-blue-500" />} value={overview.projects?.total ?? 0} label="活跃项目" />
          <OverviewCard icon={<Image className="h-5 w-5 text-green-500" />} value={overview.images?.total ?? 0} label="图片总数" />
          <OverviewCard icon={<TrendingUp className="h-5 w-5 text-blue-600" />} value={`${overview.progress ?? 0}%`} label="标注进度" />
          <OverviewCard icon={<CheckCircle className="h-5 w-5 text-green-600" />} value={overview.images?.approved ?? 0} label="审核通过" />
        </div>
      )}

      {/* Project selector */}
      <div className="flex items-center gap-3">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <select className="rounded-md border px-3 py-2 text-sm min-w-[240px]" value={selectedPid}
          onChange={(e) => setSelectedPid(e.target.value)}>
          <option value="">-- 选择项目查看详情 --</option>
          {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>

      {!selectedPid ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <BarChart3 className="mb-2 h-10 w-10" />
          <p>选择一个项目以查看详细统计</p>
        </div>
      ) : loading ? (
        <p className="py-10 text-center text-muted-foreground">加载中...</p>
      ) : (
        <>
          {/* Summary cards */}
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard value={dashboard.images?.total ?? 0} label="图片" sub={`已标注 ${dashboard.images?.annotated ?? 0}`} />
              <StatCard value={dashboard.annotations?.total ?? 0} label="标注" sub={`自动 ${dashboard.annotations?.auto ?? 0}`} />
              <StatCard value={`${dashboard.reviews?.pass_rate ?? 0}%`} label="通过率" color="green"
                sub={`通过 ${dashboard.reviews?.approved ?? 0} · 退回 ${dashboard.reviews?.rejected ?? 0}`} />
              <StatCard value={dashboard.reviews?.pending ?? 0} label="待审核" color="amber" />
              <StatCard value={members.length} label="参与人数" color="blue" />
            </div>
          )}

          {/* Member breakdown — the core feature */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />项目成员 ({members.length}人)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length > 0 ? (
                <>
                  {/* Bar chart */}
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={members} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="display_name" tick={{ fontSize: 11 }} width={70} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="uploads" fill="#3b82f6" name="上传" stackId="a" />
                      <Bar dataKey="annotations" fill="#22c55e" name="标注" stackId="a" />
                      <Bar dataKey="reviewed_count" fill="#f59e0b" name="审核" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Table */}
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 px-2">成员</th>
                          <th className="py-2 px-2 text-right"><Upload className="inline h-3 w-3 mr-1" />上传</th>
                          <th className="py-2 px-2 text-right"><PenTool className="inline h-3 w-3 mr-1" />标注</th>
                          <th className="py-2 px-2 text-right text-xs">自动</th>
                          <th className="py-2 px-2 text-right text-xs">手动</th>
                          <th className="py-2 px-2 text-right"><CheckCircle className="inline h-3 w-3 mr-1 text-green-600" />通过</th>
                          <th className="py-2 px-2 text-right"><XCircle className="inline h-3 w-3 mr-1 text-red-500" />退回</th>
                          <th className="py-2 px-2 text-right"><Shield className="inline h-3 w-3 mr-1" />审核</th>
                          <th className="py-2 px-2 text-right">准确率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr key={m.user_id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="py-2 px-2 font-medium">{m.display_name}</td>
                            <td className="py-2 px-2 text-right">{m.uploads}</td>
                            <td className="py-2 px-2 text-right">{m.annotations}</td>
                            <td className="py-2 px-2 text-right text-xs text-muted-foreground">{m.auto_count}</td>
                            <td className="py-2 px-2 text-right text-xs text-muted-foreground">{m.manual_count}</td>
                            <td className="py-2 px-2 text-right text-green-600">{m.approved}</td>
                            <td className="py-2 px-2 text-right text-red-500">{m.rejected}</td>
                            <td className="py-2 px-2 text-right">{m.reviewed_count}</td>
                            <td className="py-2 px-2 text-right">
                              {m.accuracy != null ? (
                                <Badge variant={m.accuracy >= 80 ? "success" : m.accuracy >= 60 ? "secondary" : "destructive"} className="text-xs">
                                  {m.accuracy}%
                                </Badge>
                              ) : <span className="text-xs text-muted-foreground">-</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 text-muted-foreground/40" />
                  <p>暂无成员活动记录</p>
                  <p className="text-xs mt-1">上传图片、创建标注或进行审核后在此查看</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trends + Categories */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" />30天趋势</CardTitle></CardHeader>
              <CardContent>
                {trends.some((t: any) => t.annotations > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="annotations" stroke="#3b82f6" name="标注" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="reviews" stroke="#22c55e" name="审核" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">暂无标注数据</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" />类别分布</CardTitle></CardHeader>
              <CardContent>
                {categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={categories} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {categories.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-16 text-center text-sm text-muted-foreground">暂无类别数据</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function OverviewCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ value, label, sub, color }: { value: string | number; label: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className={`text-3xl font-bold ${color === "green" ? "text-green-600" : color === "amber" ? "text-amber-500" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
