import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, Truck, Calendar, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type DispatchStatus = "scheduled" | "in_progress" | "complete" | "cancelled";
type RateType = "hourly" | "per_load" | "per_ton" | "flat" | "other";
type InvoiceStatus = "not_billed" | "billed" | "paid";

interface DispatchOrder {
  id: string;
  dispatch_date: string;
  driver_user_id: string | null;
  driver_name: string | null;
  truck_number: string | null;
  job_id: string | null;
  job_name: string | null;
  gc: string | null;
  customer: string | null;
  material: string | null;
  pickup_location: string | null;
  dump_location: string | null;
  load_quantity: number | null;
  start_time: string | null;
  status: DispatchStatus;
  notes: string | null;
  bill_to: string | null;
  po_number: string | null;
  rate_type: RateType | null;
  rate_amount: number | null;
  billed_quantity: number | null;
  billing_total: number | null;
  invoice_status: InvoiceStatus;
  billing_notes: string | null;
}

const RATE_LABEL: Record<RateType, string> = {
  hourly: "Hourly",
  per_load: "Per Load",
  per_ton: "Per Ton",
  flat: "Flat",
  other: "Other",
};

const INVOICE_LABEL: Record<InvoiceStatus, string> = {
  not_billed: "Not Billed",
  billed: "Billed",
  paid: "Paid",
};

const INVOICE_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "outline"> = {
  not_billed: "outline",
  billed: "secondary",
  paid: "default",
};

const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n));

interface JobOpt { id: string; name: string; job_number: string | null; gc: string | null; customer: string | null }
interface DriverOpt { user_id: string; display_name: string | null; email: string | null }

const STATUS_LABEL: Record<DispatchStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  complete: "Complete",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<DispatchStatus, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "secondary",
  in_progress: "default",
  complete: "outline",
  cancelled: "destructive",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const parseISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
// Week starts on Monday
const startOfWeek = (d: Date) => { const r = new Date(d); const dow = (r.getDay() + 6) % 7; r.setDate(r.getDate() - dow); return r; };
const endOfWeek = (d: Date) => addDays(startOfWeek(d), 6);
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const startOfMonthGrid = (d: Date) => startOfWeek(startOfMonth(d));
const endOfMonthGrid = (d: Date) => endOfWeek(endOfMonth(d));

type ViewMode = "day" | "week" | "month";

const Dispatch = () => {
  const { role } = useAuth();
  const canEdit = role === "office" || role === "admin";
  const [view, setView] = useState<ViewMode>("day");
  const [date, setDate] = useState<string>(todayStr());
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [jobs, setJobs] = useState<JobOpt[]>([]);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    driver_user_id: "" as string,
    truck_number: "",
    job_id: "" as string,
    material: "",
    pickup_location: "",
    dump_location: "",
    load_quantity: "",
    start_time: "",
    notes: "",
    bill_to: "",
    po_number: "",
    rate_type: "" as RateType | "",
    rate_amount: "",
    billed_quantity: "",
    invoice_status: "not_billed" as InvoiceStatus,
    billing_notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const range = useMemo(() => {
    const d = parseISO(date);
    if (view === "day") return { start: toISO(d), end: toISO(d) };
    if (view === "week") return { start: toISO(startOfWeek(d)), end: toISO(endOfWeek(d)) };
    return { start: toISO(startOfMonthGrid(d)), end: toISO(endOfMonthGrid(d)) };
  }, [date, view]);

  const load = async () => {
    setLoading(true);
    const [{ data: ord }, { data: jb }, { data: drv }] = await Promise.all([
      supabase
        .from("dispatch_orders")
        .select("*")
        .gte("dispatch_date", range.start)
        .lte("dispatch_date", range.end)
        .order("dispatch_date")
        .order("sort_order")
        .order("start_time", { nullsFirst: false }),
      supabase.from("jobs").select("id, name, job_number, gc, customer").order("name"),
      supabase
        .from("profiles")
        .select("user_id, display_name, email, is_driver, is_active")
        .eq("is_driver", true)
        .eq("is_active", true)
        .order("display_name"),
    ]);
    setOrders((ord as DispatchOrder[]) ?? []);
    setJobs((jb as JobOpt[]) ?? []);
    setDrivers((drv as DriverOpt[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range.start, range.end]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (o: DispatchOrder) => {
    setEditingId(o.id);
    setForm({
      driver_user_id: o.driver_user_id ?? "",
      truck_number: o.truck_number ?? "",
      job_id: o.job_id ?? "",
      material: o.material ?? "",
      pickup_location: o.pickup_location ?? "",
      dump_location: o.dump_location ?? "",
      load_quantity: o.load_quantity?.toString() ?? "",
      start_time: o.start_time ?? "",
      notes: o.notes ?? "",
      bill_to: o.bill_to ?? "",
      po_number: o.po_number ?? "",
      rate_type: (o.rate_type ?? "") as RateType | "",
      rate_amount: o.rate_amount?.toString() ?? "",
      billed_quantity: o.billed_quantity?.toString() ?? "",
      invoice_status: o.invoice_status ?? "not_billed",
      billing_notes: o.billing_notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    setBusy(true);
    const driver = drivers.find((d) => d.user_id === form.driver_user_id);
    const job = jobs.find((j) => j.id === form.job_id);
    const payload = {
      dispatch_date: date,
      driver_user_id: form.driver_user_id || null,
      driver_name: driver?.display_name ?? driver?.email ?? null,
      truck_number: form.truck_number || null,
      job_id: form.job_id || null,
      job_name: job?.name ?? null,
      gc: job?.gc ?? null,
      customer: job?.customer ?? null,
      material: form.material || null,
      pickup_location: form.pickup_location || null,
      dump_location: form.dump_location || null,
      load_quantity: form.load_quantity ? Number(form.load_quantity) : null,
      start_time: form.start_time || null,
      notes: form.notes || null,
      bill_to: form.bill_to || null,
      po_number: form.po_number || null,
      rate_type: (form.rate_type || null) as RateType | null,
      rate_amount: form.rate_amount ? Number(form.rate_amount) : null,
      billed_quantity: form.billed_quantity ? Number(form.billed_quantity) : null,
      invoice_status: form.invoice_status,
      billing_notes: form.billing_notes || null,
    };
    const { error } = editingId
      ? await supabase.from("dispatch_orders").update(payload).eq("id", editingId)
      : await supabase.from("dispatch_orders").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Order updated" : "Order added");
    setOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: DispatchStatus) => {
    const { error } = await supabase.from("dispatch_orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this dispatch order?")) return;
    const { error } = await supabase.from("dispatch_orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setOrders((os) => os.filter((o) => o.id !== id));
  };

  // Group selected day's orders by driver
  const dayOrders = useMemo(() => orders.filter((o) => o.dispatch_date === date), [orders, date]);
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; orders: DispatchOrder[] }>();
    dayOrders.forEach((o) => {
      const key = o.driver_user_id ?? `__${o.driver_name ?? "Unassigned"}`;
      const name = o.driver_name ?? "Unassigned";
      if (!map.has(key)) map.set(key, { name, orders: [] });
      map.get(key)!.orders.push(o);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [dayOrders]);

  // Orders bucketed by date (for week & month views)
  const ordersByDate = useMemo(() => {
    const map = new Map<string, DispatchOrder[]>();
    orders.forEach((o) => {
      if (!map.has(o.dispatch_date)) map.set(o.dispatch_date, []);
      map.get(o.dispatch_date)!.push(o);
    });
    return map;
  }, [orders]);

  const shiftDate = (n: number) => {
    const d = parseISO(date);
    if (view === "day") setDate(toISO(addDays(d, n)));
    else if (view === "week") setDate(toISO(addDays(d, n * 7)));
    else setDate(toISO(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };

  const rangeLabel = useMemo(() => {
    const d = parseISO(date);
    if (view === "day") return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
      const s = startOfWeek(d), e = endOfWeek(d);
      const sameMonth = s.getMonth() === e.getMonth();
      const sFmt = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const eFmt = e.toLocaleDateString(undefined, { month: sameMonth ? undefined : "short", day: "numeric", year: "numeric" });
      return `${sFmt} – ${eFmt}`;
    }
    return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [date, view]);


  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide">Dispatch</h1>
            <p className="text-sm text-muted-foreground">Daily truck dispatch board</p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <Label htmlFor="date" className="text-xs uppercase tracking-wider text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" /> Jump to
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
              />
            </div>
            {canEdit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreate}><Plus className="mr-1 h-4 w-4" /> New Order</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingId ? "Edit Dispatch Order" : "New Dispatch Order"}</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3 py-2 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <Label>Driver</Label>
                      <Select value={form.driver_user_id} onValueChange={(v) => setForm({ ...form, driver_user_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                        <SelectContent>
                          {drivers.length === 0 && <div className="p-2 text-xs text-muted-foreground">No drivers tagged. Tag users in Admin → Users.</div>}
                          {drivers.map((d) => (
                            <SelectItem key={d.user_id} value={d.user_id}>{d.display_name ?? d.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Truck #</Label>
                      <Input value={form.truck_number} onChange={(e) => setForm({ ...form, truck_number: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Job</Label>
                      <Select value={form.job_id} onValueChange={(v) => setForm({ ...form, job_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
                        <SelectContent>
                          {jobs.map((j) => (
                            <SelectItem key={j.id} value={j.id}>
                              {j.job_number ? `${j.job_number} — ` : ""}{j.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Material</Label>
                      <Input value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })} placeholder="Stone, fill, topsoil…" />
                    </div>
                    <div>
                      <Label>Load Qty</Label>
                      <Input type="number" step="0.1" value={form.load_quantity} onChange={(e) => setForm({ ...form, load_quantity: e.target.value })} />
                    </div>
                    <div>
                      <Label>Pickup Location</Label>
                      <Input value={form.pickup_location} onChange={(e) => setForm({ ...form, pickup_location: e.target.value })} />
                    </div>
                    <div>
                      <Label>Dump Location</Label>
                      <Input value={form.dump_location} onChange={(e) => setForm({ ...form, dump_location: e.target.value })} />
                    </div>
                    <div>
                      <Label>Start Time</Label>
                      <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Notes</Label>
                      <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>

                    <div className="sm:col-span-2 mt-2 border-t border-border pt-3">
                      <h3 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">Billing</h3>
                    </div>
                    <div>
                      <Label>Bill To</Label>
                      <Input value={form.bill_to} onChange={(e) => setForm({ ...form, bill_to: e.target.value })} placeholder="Customer to invoice" />
                    </div>
                    <div>
                      <Label>PO / Reference #</Label>
                      <Input value={form.po_number} onChange={(e) => setForm({ ...form, po_number: e.target.value })} />
                    </div>
                    <div>
                      <Label>Rate Type</Label>
                      <Select value={form.rate_type} onValueChange={(v) => setForm({ ...form, rate_type: v as RateType })}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(RATE_LABEL) as RateType[]).map((r) => (
                            <SelectItem key={r} value={r}>{RATE_LABEL[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rate ($)</Label>
                      <Input type="number" step="0.01" value={form.rate_amount} onChange={(e) => setForm({ ...form, rate_amount: e.target.value })} />
                    </div>
                    <div>
                      <Label>Billed Qty</Label>
                      <Input type="number" step="0.01" value={form.billed_quantity} onChange={(e) => setForm({ ...form, billed_quantity: e.target.value })} placeholder="hrs / loads / tons" />
                    </div>
                    <div>
                      <Label>Invoice Status</Label>
                      <Select value={form.invoice_status} onValueChange={(v) => setForm({ ...form, invoice_status: v as InvoiceStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(INVOICE_LABEL) as InvoiceStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{INVOICE_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Billing Notes</Label>
                      <Textarea rows={2} value={form.billing_notes} onChange={(e) => setForm({ ...form, billing_notes: e.target.value })} />
                    </div>
                    {form.rate_amount && form.billed_quantity && (
                      <div className="sm:col-span-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                        Estimated Total: <span className="font-medium">{fmtMoney(Number(form.rate_amount) * Number(form.billed_quantity))}</span>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* View tabs + range navigation */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDate(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center text-sm font-medium">{rangeLabel}</div>
            <Button variant="outline" size="icon" onClick={() => shiftDate(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDate(todayStr())}>Today</Button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {/* WEEK VIEW */}
          {!loading && view === "week" && (() => {
            const start = startOfWeek(parseISO(date));
            const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
            const totalCount = orders.length;
            return (
              <div>
                <p className="mb-3 text-xs text-muted-foreground">{totalCount} order{totalCount === 1 ? "" : "s"} this week</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                  {days.map((d) => {
                    const iso = toISO(d);
                    const list = ordersByDate.get(iso) ?? [];
                    const isToday = iso === todayStr();
                    return (
                      <button
                        key={iso}
                        onClick={() => { setDate(iso); setView("day"); }}
                        className={`group rounded-xl border p-3 text-left transition hover:border-primary ${isToday ? "border-primary bg-primary/5" : "border-border bg-surface"}`}
                      >
                        <div className="flex items-baseline justify-between">
                          <div className="font-display text-xs uppercase tracking-wider text-muted-foreground">
                            {d.toLocaleDateString(undefined, { weekday: "short" })}
                          </div>
                          <div className="text-lg font-semibold">{d.getDate()}</div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {list.length === 0 ? "No orders" : `${list.length} order${list.length === 1 ? "" : "s"}`}
                        </div>
                        {list.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {list.slice(0, 3).map((o) => (
                              <li key={o.id} className="truncate text-xs">
                                <span className="text-muted-foreground">{o.start_time?.slice(0, 5) ?? "—"}</span>{" "}
                                {o.driver_name ?? "Unassigned"} · {o.job_name ?? "—"}
                              </li>
                            ))}
                            {list.length > 3 && (
                              <li className="text-xs text-muted-foreground">+{list.length - 3} more</li>
                            )}
                          </ul>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* MONTH VIEW */}
          {!loading && view === "month" && (() => {
            const cur = parseISO(date);
            const gridStart = startOfMonthGrid(cur);
            const gridEnd = endOfMonthGrid(cur);
            const days: Date[] = [];
            for (let d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) days.push(new Date(d));
            return (
              <div>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-display uppercase tracking-wider text-muted-foreground">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map((d) => {
                    const iso = toISO(d);
                    const list = ordersByDate.get(iso) ?? [];
                    const inMonth = d.getMonth() === cur.getMonth();
                    const isToday = iso === todayStr();
                    return (
                      <button
                        key={iso}
                        onClick={() => { setDate(iso); setView("day"); }}
                        className={`min-h-[72px] rounded-md border p-1.5 text-left transition hover:border-primary ${
                          isToday ? "border-primary bg-primary/5" :
                          inMonth ? "border-border bg-surface" : "border-border/50 bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{d.getDate()}</span>
                          {list.length > 0 && (
                            <Badge variant="secondary" className="h-4 px-1 text-[10px]">{list.length}</Badge>
                          )}
                        </div>
                        {list.slice(0, 2).map((o) => (
                          <div key={o.id} className="mt-0.5 truncate text-[10px] leading-tight">
                            {o.driver_name?.split(" ")[0] ?? "—"}
                          </div>
                        ))}
                        {list.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">+{list.length - 2}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* DAY VIEW (existing) */}
          {!loading && view === "day" && dayOrders.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <Truck className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No dispatch orders for {date}.</p>
            </div>
          )}
          {!loading && view === "day" && grouped.map((g) => (
            <section key={g.name}>
              <h2 className="mb-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
                {g.name} <span className="text-muted-foreground/60">· {g.orders.length}</span>
              </h2>
              <div className="space-y-2">
                {g.orders.map((o) => (
                  <div key={o.id} className="rounded-xl border border-border bg-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                          {o.start_time && <span className="text-xs font-medium">{o.start_time.slice(0, 5)}</span>}
                          {o.truck_number && <span className="text-xs text-muted-foreground">Truck #{o.truck_number}</span>}
                        </div>
                        <p className="mt-1 font-medium">{o.job_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[o.gc, o.customer].filter(Boolean).join(" · ")}
                        </p>
                        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                          {o.material && <div><span className="text-muted-foreground">Material:</span> {o.material}{o.load_quantity ? ` · ${o.load_quantity}` : ""}</div>}
                          {o.pickup_location && <div><span className="text-muted-foreground">Pickup:</span> {o.pickup_location}</div>}
                          {o.dump_location && <div><span className="text-muted-foreground">Dump:</span> {o.dump_location}</div>}
                        </div>
                        {o.notes && <p className="mt-2 text-sm text-muted-foreground">{o.notes}</p>}
                        {(o.bill_to || o.po_number || o.rate_amount || o.billing_total || o.invoice_status !== "not_billed" || o.billing_notes) && (
                          <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-2 text-xs">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-display uppercase tracking-wider text-muted-foreground">Billing</span>
                              <Badge variant={INVOICE_VARIANT[o.invoice_status]}>{INVOICE_LABEL[o.invoice_status]}</Badge>
                            </div>
                            <div className="grid gap-1 sm:grid-cols-2">
                              {o.bill_to && <div><span className="text-muted-foreground">Bill To:</span> {o.bill_to}</div>}
                              {o.po_number && <div><span className="text-muted-foreground">PO #:</span> {o.po_number}</div>}
                              {(o.rate_amount != null || o.rate_type) && (
                                <div>
                                  <span className="text-muted-foreground">Rate:</span> {fmtMoney(o.rate_amount)}
                                  {o.rate_type ? ` ${RATE_LABEL[o.rate_type]}` : ""}
                                </div>
                              )}
                              {o.billed_quantity != null && <div><span className="text-muted-foreground">Qty:</span> {o.billed_quantity}</div>}
                              {o.billing_total != null && Number(o.billing_total) > 0 && (
                                <div className="sm:col-span-2"><span className="text-muted-foreground">Total:</span> <span className="font-medium">{fmtMoney(o.billing_total)}</span></div>
                              )}
                              {o.billing_notes && <div className="sm:col-span-2 text-muted-foreground">{o.billing_notes}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex flex-col items-end gap-2">
                          <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v as DispatchStatus)}>
                            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(STATUS_LABEL) as DispatchStatus[]).map((s) => (
                                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEdit(o)}>Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(o.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dispatch;
