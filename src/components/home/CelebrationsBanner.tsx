import { useEffect, useState } from "react";
import { Cake, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

interface Item {
  id: string;
  kind: "birthday" | "anniversary";
  name: string;
  years?: number;
}

// Returns "MM-DD" for an ISO date
const mmdd = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const todayMMDD = () => {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${String(ny.getMonth() + 1).padStart(2, "0")}-${String(ny.getDate()).padStart(2, "0")}`;
};

const yearsBetween = (from: string) => {
  const f = new Date(from + "T00:00:00");
  const now = new Date();
  let y = now.getFullYear() - f.getFullYear();
  const before =
    now.getMonth() < f.getMonth() ||
    (now.getMonth() === f.getMonth() && now.getDate() < f.getDate());
  if (before) y -= 1;
  return y;
};

export const CelebrationsBanner = () => {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("employee_contacts")
        .select("id, name, date_of_birth, hire_date, is_active")
        .eq("is_active", true);
      const today = todayMMDD();
      const list: Item[] = [];
      (data ?? []).forEach((c) => {
        const name = (c.name as string) ?? "";
        const dob = c.date_of_birth as string | null;
        const hire = c.hire_date as string | null;
        if (dob && mmdd(dob) === today) {
          list.push({ id: `${c.id}-b`, kind: "birthday", name });
        }
        if (hire && mmdd(hire) === today) {
          const years = yearsBetween(hire);
          if (years >= 1) {
            list.push({ id: `${c.id}-a`, kind: "anniversary", name, years });
          }
        }
      });
      setItems(list);
    })();
  }, []);

  if (!items.length) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-4">
      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
        <PartyPopper className="h-3.5 w-3.5" /> Celebrate today
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            {it.kind === "birthday" ? (
              <Cake className="h-4 w-4 text-accent" />
            ) : (
              <PartyPopper className="h-4 w-4 text-primary" />
            )}
            <span className="font-medium">{it.name}</span>
            <span className="text-muted-foreground">
              {it.kind === "birthday"
                ? "— Happy birthday!"
                : `— ${it.years} year${it.years === 1 ? "" : "s"} with Schreiber`}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
};
