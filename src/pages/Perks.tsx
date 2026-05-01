import { useNavigate } from "react-router-dom";
import { ShoppingBag, Palmtree, HandCoins, ChevronRight, Sparkles, Wrench, Cog, Network } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

type PerkItem = {
  key: string;
  label: string;
  hint: string;
  icon: typeof ShoppingBag;
  to?: string;
  href?: string;
};

const ITEMS: PerkItem[] = [
  {
    key: "apparel",
    label: "Order Apparel",
    hint: "Shirts, hats, vests",
    icon: ShoppingBag,
    to: "/apparel",
  },
  {
    key: "timeoff",
    label: "Time Off",
    hint: "Request vacation or PTO",
    icon: Palmtree,
    to: "/time-off",
  },
  {
    key: "referrals",
    label: "Referrals",
    hint: "Refer hires & jobs — earn $",
    icon: HandCoins,
    to: "/referrals",
  },
  {
    key: "equipment",
    label: "Rent Equipment",
    hint: "Borrow company gear — waiver required",
    icon: Wrench,
    to: "/equipment-rental",
  },
  {
    key: "shop",
    label: "Mechanic Shop",
    hint: "Reserve a day in the shop",
    icon: Cog,
    to: "/shop-booking",
  },
  {
    key: "orgchart",
    label: "Org Chart",
    hint: "See who's who at Schreiber Excavating",
    icon: Network,
    href: "/org-chart.pdf",
  },
];

const Perks = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-4">
        <button
          onClick={() => navigate("/")}
          className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
        >
          ← Home
        </button>
        <h1 className="mt-2 flex items-center gap-2 font-display text-2xl font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          My Perks
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Apparel, time off, and referral rewards in one place.
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <ul className="space-y-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  onClick={() => navigate(item.to)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-semibold">
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      <BottomNav />
    </div>
  );
};

export default Perks;
