import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCategoryTree, createCategory, updateCategory } from "@/services/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tags, Plus, ChevronRight, ChevronDown } from "lucide-react";

interface CatNode {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  shortcut_key?: string;
  is_active: boolean;
  children: CatNode[];
}

function TreeNode({ node, depth, selectedId, onSelect, onToggle, expanded }: {
  node: CatNode; depth: number; selectedId: string | null;
  onSelect: (n: CatNode) => void; onToggle: (id: string) => void; expanded: Set<string>;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  return (
    <div>
      <div
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm hover:bg-gray-100 ${selectedId === node.id ? "bg-blue-50" : ""}`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <span onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}>
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </span>
        ) : <span className="w-3" />}
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: node.color }} />
        <span className="flex-1">{node.name}</span>
        {node.shortcut_key && <span className="text-xs text-muted-foreground">{node.shortcut_key}</span>}
      </div>
      {isOpen && hasChildren && node.children.map((c) => (
        <TreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onToggle={onToggle} expanded={expanded} />
      ))}
    </div>
  );
}

export default function CategoryPage() {
  const { pid } = useParams();
  const [tree, setTree] = useState<CatNode[]>([]);
  const [selected, setSelected] = useState<CatNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3388FF");
  const [shortcut, setShortcut] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);

  async function load() {
    if (!pid) return;
    const data = await getCategoryTree(pid);
    setTree(data.items || []);
  }

  useEffect(() => { load(); }, [pid]);

  function handleSelect(node: CatNode) {
    setSelected(node);
    setName(node.name);
    setColor(node.color);
    setShortcut(node.shortcut_key || "");
    setParentId(node.parent_id);
  }

  async function handleCreate() {
    if (!pid || !name.trim()) return;
    await createCategory(pid, { name: name.trim(), color, shortcut_key: shortcut || undefined, parent_id: parentId });
    setName(""); setShortcut(""); setParentId(null);
    await load();
  }

  async function handleUpdate() {
    if (!selected || !name.trim()) return;
    await updateCategory(selected.id, { name: name.trim(), color, shortcut_key: shortcut || undefined });
    await load();
    setSelected(null); setName(""); setShortcut("");
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">类别管理</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tree panel */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 font-semibold">标签树</h3>
            {tree.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-muted-foreground">
                <Tags className="mb-2 h-8 w-8" />
                <p className="text-sm">暂无类别，创建第一个</p>
              </div>
            ) : (
              tree.map((node) => (
                <TreeNode key={node.id} node={node} depth={0} selectedId={selected?.id || null} onSelect={handleSelect} onToggle={toggleExpand} expanded={expanded} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Editor panel */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold">{selected ? "编辑类别" : "新建类别"}</h3>
            <div>
              <label className="mb-1 block text-sm font-medium">名称</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="类别名称" />
            </div>
            <div className="flex gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">颜色</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-16 rounded border" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">快捷键</label>
                <Input value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="如: 1, A" className="w-20" maxLength={4} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">父类别</label>
                <select className="flex h-10 rounded-md border bg-background px-3 py-2 text-sm" value={parentId || ""}
                  onChange={(e) => setParentId(e.target.value || null)}>
                  <option value="">无（根类别）</option>
                  {tree.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              {selected ? (
                <>
                  <Button onClick={handleUpdate}>保存修改</Button>
                  <Button variant="ghost" onClick={() => { setSelected(null); setName(""); setShortcut(""); }}>取消</Button>
                </>
              ) : (
                <Button onClick={handleCreate}><Plus className="mr-1 h-4 w-4" /> 添加类别</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
