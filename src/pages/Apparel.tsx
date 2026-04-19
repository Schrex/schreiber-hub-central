import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Trash2, Download } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Item = {
  id: string;
  name: string;
  description: string | null;
  sizes: string[];
  colors: string[];
};

type Order = {
  id: string;
  user_id: string;
  item_name: string;
  size: string;
  color: string;
  quantity: number;
  notes: string | null;
  status: "requested" | "ordered" | "received" | "distributed" | "cancelled";
  created_at: string;
};

const formSchema = z.object({
  item_id: z.string().uuid(),
  size: z.string().min(1, "Pick a size"),
  color: z.string().min(1, "Pick a color"),
  quantity: z.coerce.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
});

const STATUS_COLORS: Record<Order["status"], string> = {
  requested: "bg-muted text-muted-foreground",
  ordered: "bg-primary/15 text-primary",
  received: "bg-accent text-accent-foreground",
  distributed: "bg-role-office/15 text-role-office",
  cancelled: "bg-destructive/15 text-destructive",
};

const Apparel = () => {
  const navigate = useNavigate();
  const { user, role, displayName } = useAuth();
  const isOffice = role === "office" || role === "admin";

  const [items, setItems] = useState<Item[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<(Order & { display_name?: string | null; email?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form
  const [itemId, setItemId] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  const selectedItem = items.find((i) => i.id === itemId);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOffice]);

  const load = async () => {
    setLoading(true);
    const { data: itemsData } = await supabase
      .from("clothing_items")
      .select("id,name,description,sizes,colors")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    setItems((itemsData ?? []) as Item[]);

    if (user) {
      const { data: mine } = await supabase
        .from("clothing_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setMyOrders((mine ?? []) as Order[]);
    }

    if (isOffice) {
      const { data: all } = await supabase
        .from("clothing_orders")
        .select("*")
        .order("created_at", { ascending: false });
      const userIds = Array.from(new Set((all ?? []).map((o) => o.user_id)));
      let profileMap: Record<string, { display_name: string | null; email: string | null }> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,display_name,email")
          .in("user_id", userIds);
        profileMap = Object.fromEntries(
          (profs ?? []).map((p) => [p.user_id, { display_name: p.display_name, email: p.email }]),
        );
      }
      setAllOrders(
        ((all ?? []) as Order[]).map((o) => ({
          ...o,
          display_name: profileMap[o.user_id]?.display_name ?? null,
          email: profileMap[o.user_id]?.email ?? null,
        })),
      );
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedItem) return;
    const parsed = formSchema.safeParse({ item_id: itemId, size, color, quantity, notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("clothing_orders").insert({
      user_id: user.id,
      item_id: itemId,
      item_name: selectedItem.name,
      size,
      color,
      quantity,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Request submitted");
    setItemId("");
    setSize("");
    setColor("");
    setQuantity(1);
    setNotes("");
    void load();
  };

  const cancelOrder = async (id: string) => {
    const { error } = await supabase.from("clothing_orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    void load();
  };

  const updateStatus = async (id: string, status: Order["status"]) => {
    const { error } = await supabase.from("clothing_orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const exportCsv = () => {
    const rows = [
      ["Date", "Employee", "Email", "Item", "Size", "Color", "Qty", "Notes", "Status"],
      ...allOrders.map((o) => [
        new Date(o.created_at).toLocaleDateString(),
        o.display_name ?? "",
        o.email ?? "",
        o.item_name,
        o.size,
        o.color,
        String(o.quantity),
        (o.notes ?? "").replace(/[\r\n]+/g, " "),
        o.status,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `apparel-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h1 className="font-display text-lg uppercase tracking-wide">Order Apparel</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 pb-12">
        <Tabs defaultValue="order">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="order">Order</TabsTrigger>
            <TabsTrigger value="mine">My Orders ({myOrders.length})</TabsTrigger>
            {isOffice && <TabsTrigger value="all">All ({allOrders.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="order" className="mt-4">
            <Card className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hi {displayName ?? "there"} — pick what you need. Office will batch & order.
                </p>

                <div>
                  <Label>Item</Label>
                  <Select
                    value={itemId}
                    onValueChange={(v) => {
                      setItemId(v);
                      setSize("");
                      setColor("");
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose an item" /></SelectTrigger>
                    <SelectContent>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedItem?.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{selectedItem.description}</p>
                  )}
                </div>

                {selectedItem && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Size</Label>
                      <Select value={size} onValueChange={setSize}>
                        <SelectTrigger><SelectValue placeholder="Size" /></SelectTrigger>
                        <SelectContent>
                          {selectedItem.sizes.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Select value={color} onValueChange={setColor}>
                        <SelectTrigger><SelectValue placeholder="Color" /></SelectTrigger>
                        <SelectContent>
                          {selectedItem.colors.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Anything else? (tall fit, name embroidery, etc.)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting || !itemId || !size || !color}>
                  {submitting ? "Submitting…" : "Submit request"}
                </Button>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="mine" className="mt-4 space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : myOrders.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">No orders yet.</Card>
            ) : (
              myOrders.map((o) => (
                <Card key={o.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{o.item_name}</p>
                      <Badge className={STATUS_COLORS[o.status]} variant="secondary">{o.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.size} · {o.color} · Qty {o.quantity} · {new Date(o.created_at).toLocaleDateString()}
                    </p>
                    {o.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{o.notes}"</p>}
                  </div>
                  {o.status === "requested" && (
                    <Button variant="ghost" size="icon" onClick={() => cancelOrder(o.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {isOffice && (
            <TabsContent value="all" className="mt-4 space-y-2">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={!allOrders.length}>
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : allOrders.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">No orders yet.</Card>
              ) : (
                allOrders.map((o) => (
                  <Card key={o.id} className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{o.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.display_name ?? o.email ?? "Unknown"} · {o.size} · {o.color} · Qty {o.quantity}
                        </p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString()}
                        </p>
                        {o.notes && <p className="mt-1 text-xs italic text-muted-foreground">"{o.notes}"</p>}
                      </div>
                      <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v as Order["status"])}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="requested">Requested</SelectItem>
                          <SelectItem value="ordered">Ordered</SelectItem>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="distributed">Distributed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Apparel;
