import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, DollarSign, TrendingUp, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
  const { user } = useAuth();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

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
