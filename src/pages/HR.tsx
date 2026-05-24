import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck,
  DollarSign,
  Palmtree,
  Users,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

const ITEMS = [
  {
    key: "reviews",
    label: "Performance Reviews",
    hint: "Create, send & track reviews",
    icon: ClipboardCheck,
    to: "/tools/performance-reviews",
    comingSoon: true,
  },
  {
    key: "positions",
    label: "Positions & Pay",
    hint: "Roles, ranges & assignments",
    icon: DollarSign,
    to: "/admin/positions",
    comingSoon: true,
  },
  {
    key: "timeoff",
    label: "Time Off Approvals",
    hint: "Review pending requests",
    icon: Palmtree,
    to: "/time-off",
  },
  {
    key: "contacts",
    label: "Employee Contacts",
    hint: "Crew phone book & onboarding",
    icon: Users,
    to: "/employee-contacts",
  },
];

const HR = () => {
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
          <Briefcase className="h-5 w-5 text-primary" />
          HR
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          People, pay, reviews & time off in one place.
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        <ul className="space-y-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  onClick={() => !item.comingSoon && navigate(item.to)}
                  disabled={item.comingSoon}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-surface"
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
                  {item.comingSoon ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Soon
                    </span>
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                  )}
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

export default HR;
