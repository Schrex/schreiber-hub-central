import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Network, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

type OrgNode = {
  id: string;
  name: string;
  title: string | null;
  parent_id: string | null;
  sort_order: number;
  contact_id: string | null;
};

type TreeNode = OrgNode & { children: TreeNode[] };

const buildTrees = (nodes: OrgNode[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (arr: TreeNode[]) => {
    arr.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    arr.forEach((c) => sortRec(c.children));
  };
  sortRec(roots);
  return roots;
};

const NodeCard = ({ node, onClick }: { node: TreeNode; onClick: (n: TreeNode) => void }) => (
  <button
    onClick={() => onClick(node)}
    className="group flex w-28 flex-col items-center gap-1 rounded-lg border border-border bg-surface p-1.5 text-center shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
  >
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
      <User className="h-3.5 w-3.5" />
    </span>
    <span className="text-[11px] font-semibold leading-tight">{node.name}</span>
    {node.title && (
      <span className="text-[9px] leading-tight text-muted-foreground line-clamp-2">{node.title}</span>
    )}
  </button>
);

const Branch = ({ node, onClick }: { node: TreeNode; onClick: (n: TreeNode) => void }) => {
  const hasKids = node.children.length > 0;
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} onClick={onClick} />
      {hasKids && (
        <>
          <div className="h-2 w-px bg-border" />
          <div className="relative flex items-start gap-2">
            {node.children.length > 1 && (
              <div className="absolute left-0 right-0 top-0 h-px bg-border" />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="relative flex flex-col items-center pt-2">
                <div className="absolute top-0 h-2 w-px bg-border" />
                <Branch node={child} onClick={onClick} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const OrgChart = () => {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("org_chart_nodes")
      .select("id, name, title, parent_id, sort_order, contact_id")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setNodes((data ?? []) as OrgNode[]);
        setLoading(false);
      });
  }, []);

  const trees = useMemo(() => buildTrees(nodes), [nodes]);

  const handleClick = (n: TreeNode) => {
    if (n.contact_id) navigate(`/employee-contacts?focus=${n.contact_id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-4">
        <button
          onClick={() => navigate("/perks")}
          className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          ← My Perks
        </button>
        <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-bold">
          <Network className="h-5 w-5 text-primary" />
          Org Chart
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Tap any person to view their contact card.
        </p>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 pb-24">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : trees.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No org chart entries yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-6">
            <div className="flex min-w-max flex-col items-center gap-8">
              {trees.length === 1 ? (
                <Branch node={trees[0]} onClick={handleClick} />
              ) : (
                <div className="flex items-start gap-8">
                  {trees.map((t) => (
                    <Branch key={t.id} node={t} onClick={handleClick} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default OrgChart;
