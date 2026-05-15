import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, DollarSign, TrendingUp, Lock, Sparkles, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface PromotionTarget {
  id: string;
  title: string;
  description: string | null;
  min_pay_rate: number;
  max_pay_rate: number;
  is_salaried: boolean;
  heldBy: string[];
}

interface AssignmentRow {
  id: string;
  pay_rate: number;
  effective_date: string;
  end_date: string | null;
  notes: string | null;
  is_salaried: boolean;
  position: {
    id: string;
    title: string;
    description: string | null;
    min_pay_rate: number;
    max_pay_rate: number;
    is_salaried: boolean;
  } | null;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const MyPosition = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<PromotionTarget[]>([]);
  const [hireDate, setHireDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("employee_positions")
        .select("id, pay_rate, effective_date, end_date, notes, is_salaried, position:positions(id, title, description, min_pay_rate, max_pay_rate, is_salaried)")
        .eq("user_id", user.id)
        .order("effective_date", { ascending: false });
      if (!error && data) setRows(data as unknown as AssignmentRow[]);
      setLoading(false);

      // Hire date from linked employee_contact
      const { data: prof } = await supabase
        .from("profiles")
        .select("contact_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const cid = (prof as { contact_id?: string | null } | null)?.contact_id;
      if (cid) {
        const { data: contact } = await supabase
          .from("employee_contacts")
          .select("hire_date")
          .eq("id", cid)
          .maybeSingle();
        setHireDate((contact?.hire_date as string | null) ?? null);
      }
    })();
  }, [user]);

  // Load possible promotions based on org chart hierarchy
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("contact_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const contactId = profile?.contact_id;
      if (!contactId) return;

      const { data: allNodes } = await supabase
        .from("org_chart_nodes")
        .select("id, name, title, parent_id, contact_id");
      if (!allNodes) return;

      const myNode = allNodes.find((n) => n.contact_id === contactId);
      if (!myNode || !myNode.parent_id) return;

      const parentNode = allNodes.find((n) => n.id === myNode.parent_id);
      if (!parentNode) return;

      // Promotion candidates: my manager's title + my manager's peers (uncles/aunts)
      const candidates = allNodes.filter(
        (n) => n.id === parentNode.id || (parentNode.parent_id && n.parent_id === parentNode.parent_id),
      );

      const titleToHolders = new Map<string, string[]>();
      candidates.forEach((n) => {
        if (!n.title) return;
        const arr = titleToHolders.get(n.title) ?? [];
        arr.push(n.name);
        titleToHolders.set(n.title, arr);
      });

      const titles = Array.from(titleToHolders.keys());
      if (titles.length === 0) return;

      const { data: positions } = await supabase
        .from("positions")
        .select("id, title, description, min_pay_rate, max_pay_rate, is_salaried")
        .in("title", titles);

      const promos: PromotionTarget[] = (positions ?? []).map((p) => ({
        ...p,
        heldBy: titleToHolders.get(p.title) ?? [],
      }));
      setPromotions(promos);
    })();
  }, [user]);

  const today = new Date().toISOString().slice(0, 10);
  const current = rows.find((r) => r.effective_date <= today && (!r.end_date || r.end_date >= today)) ?? rows[0];
  const history = rows.filter((r) => r.id !== current?.id);

  const rangePos = current?.position
    ? Math.min(
        100,
        Math.max(
          0,
          ((current.pay_rate - current.position.min_pay_rate) /
            Math.max(0.01, current.position.max_pay_rate - current.position.min_pay_rate)) *
            100,
        ),
      )
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">My Position</h1>
            <p className="text-xs text-muted-foreground">Private — only visible to you</p>
          </div>
          <Lock className="h-4 w-4 text-muted-foreground" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && !current && (
          <Card className="p-6 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No position assigned yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your manager hasn't set your position. Reach out if this looks wrong.
            </p>
          </Card>
        )}

        {current?.position && (
          <Card className="space-y-5 p-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Current Position
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl">{current.position.title}</h2>
              </div>
              {current.position.description && (
                <p className="mt-1 text-sm text-muted-foreground">{current.position.description}</p>
              )}
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" /> Your Rate
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Effective {fmtDate(current.effective_date)}
                </div>
              </div>
              <div className="mt-1 font-display text-3xl">{fmtMoney(current.pay_rate)}<span className="text-sm font-normal text-muted-foreground">{current.is_salaried ? "/yr" : "/hr"}</span></div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" /> Pay Range for This Position
              </div>
              <div className="relative h-2 rounded-full bg-muted">
                <div
                  className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-background bg-primary shadow"
                  style={{ left: `${rangePos}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{fmtMoney(current.position.min_pay_rate)}{current.position.is_salaried ? "/yr" : "/hr"}</span>
                <span>{fmtMoney(current.position.max_pay_rate)}{current.position.is_salaried ? "/yr" : "/hr"}</span>
              </div>
            </div>

            {current.notes && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</div>
                <p className="mt-1">{current.notes}</p>
              </div>
            )}
          </Card>
        )}

        {hireDate && (() => {
          const f = new Date(hireDate + "T00:00:00");
          const now = new Date();
          let years = now.getFullYear() - f.getFullYear();
          const before =
            now.getMonth() < f.getMonth() ||
            (now.getMonth() === f.getMonth() && now.getDate() < f.getDate());
          if (before) years -= 1;
          return (
            <Card className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Hire date
                  </div>
                  <div className="font-medium">{fmtDate(hireDate)}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Years of service
                </div>
                <div className="font-display text-xl">{Math.max(0, years)}</div>
              </div>
            </Card>
          );
        })()}

        {!loading && promotions.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Possible Promotions
            </h3>
            <p className="mb-2 px-1 text-[11px] text-muted-foreground">
              Next-step roles based on your spot in the org chart.
            </p>
            <div className="space-y-2">
              {promotions.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold">{p.title}</div>
                      {p.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                      )}
                      {p.heldBy.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Currently held by {p.heldBy.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Range</div>
                      <div className="text-sm font-semibold">
                        {fmtMoney(p.min_pay_rate)} – {fmtMoney(p.max_pay_rate)}
                        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                          {p.is_salaried ? "/yr" : "/hr"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {history.length > 0 && (
          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              History
            </h3>
            <div className="space-y-2">
              {history.map((r) => (
                <Card key={r.id} className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{r.position?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(r.effective_date)}
                      {r.end_date ? ` – ${fmtDate(r.end_date)}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{fmtMoney(r.pay_rate)}<span className="text-xs font-normal text-muted-foreground">{r.is_salaried ? "/yr" : "/hr"}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default MyPosition;
