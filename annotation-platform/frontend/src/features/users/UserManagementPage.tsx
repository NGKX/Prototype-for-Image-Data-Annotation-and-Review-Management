import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { listUsers, createUser, updateUser, deleteUser } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Plus, Trash2, Shield, UserX, Users,
} from "lucide-react";

const roleLabel: Record<string, string> = {
  admin: "管理员", data_manager: "数据管理员", reviewer: "审核员", annotator: "标注员",
};
const roleColor: Record<string, "default" | "secondary" | "success" | "destructive"> = {
  admin: "destructive", data_manager: "secondary", reviewer: "success", annotator: "default",
};

export default function UserManagementPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("annotator");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await listUsers(1, 100);
      setUsers(data.items || []);
      setTotal(data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!newUsername.trim() || !newPassword.trim()) return;
    setError("");
    setCreating(true);
    try {
      await createUser({
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
        display_name: newDisplayName || undefined,
      });
      setNewUsername(""); setNewPassword(""); setNewDisplayName(""); setNewRole("annotator");
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await updateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch (e) { console.error(e); }
  }

  async function handleToggleActive(userId: string, currentActive: boolean) {
    try {
      await updateUser(userId, { is_active: !currentActive });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_active: !currentActive } : u));
    } catch (e) { console.error(e); }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm("确定要永久删除该用户吗？此操作不可撤销。")) return;
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setTotal((t) => t - 1);
    } catch (err: any) {
      alert(err?.response?.data?.detail || "删除失败");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户管理</h1>
          <p className="text-sm text-muted-foreground">共 {total} 个用户</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="mr-1 h-4 w-4" />
          新建账号
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">新建用户账号</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-sm font-medium">用户名</label>
                <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="登录用户名" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">密码</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少6位" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">显示名称</label>
                <Input value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="选填" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">角色</label>
                <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="admin">管理员</option>
                  <option value="data_manager">数据管理员</option>
                  <option value="reviewer">审核员</option>
                  <option value="annotator">标注员</option>
                </select>
              </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "创建中..." : "创建"}
              </Button>
              <Button variant="ghost" onClick={() => { setShowCreate(false); setError(""); }}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* User table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-3 px-4">用户名</th>
                <th className="py-3 px-4">显示名称</th>
                <th className="py-3 px-4">角色</th>
                <th className="py-3 px-4">状态</th>
                <th className="py-3 px-4">创建时间</th>
                <th className="py-3 px-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className={`border-b last:border-0 ${!u.is_active ? "bg-gray-50 text-muted-foreground" : ""}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{u.username}</span>
                      {u.id === currentUser?.id && (
                        <Badge variant="outline" className="text-[10px]">我</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">{u.display_name || "-"}</td>
                  <td className="py-3 px-4">
                    <select
                      className="rounded border px-2 py-1 text-xs"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === currentUser?.id}
                    >
                      <option value="admin">管理员</option>
                      <option value="data_manager">数据管理员</option>
                      <option value="reviewer">审核员</option>
                      <option value="annotator">标注员</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={u.is_active ? "success" : "destructive"} className="text-xs">
                      {u.is_active ? "正常" : "已停用"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {u.id !== currentUser?.id && (
                        <>
                          <Button variant="ghost" size="sm" className="text-xs"
                            onClick={() => handleToggleActive(u.id, u.is_active)}>
                            <UserX className="mr-1 h-3 w-3" />
                            {u.is_active ? "停用" : "启用"}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-xs text-red-500"
                            onClick={() => handleDelete(u.id)}>
                            <Trash2 className="mr-1 h-3 w-3" />删除
                          </Button>
                        </>
                      )}
                      {u.id === currentUser?.id && (
                        <span className="text-xs text-muted-foreground">当前用户</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
