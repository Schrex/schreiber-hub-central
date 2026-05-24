import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Wrench, ClipboardCheck, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Tool = {
  key: string;
  label: string;
  hint: string;
  icon: typeof Truck;
  to: string;
  comingSoon?: boolean;
};

const TOOLS: Tool[] = [
  {
    key: "trucking",
    label: "Trucking Price Calculator",
    hint: "Estimate haul cost by load, distance, and rate",
    icon: Truck,
    to: "/tools/trucking",
    comingSoon: true,
  },
  {
    key: "reviews",
    label: "Performance Reviews",
    hint: "View and manage employee reviews",
    icon: ClipboardCheck,
    to: "/tools/performance-reviews",
    comingSoon: true,
  },
  {
    key: "handbook",
    label: "Employee Handbook",
    hint: "Company policies & procedures",
    icon: BookOpen,
    to: "/tools/handbook",
    comingSoon: true,
  },
];

const Tools = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold">Tools</h1>
            <p className="text-xs text-muted-foreground">Quick calculators and utilities</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => !t.comingSoon && navigate(t.to)}
              disabled={t.comingSoon}
              className="block w-full text-left disabled:opacity-60"
            >
              <Card className="flex items-center gap-4 p-4 transition hover:bg-muted">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.hint}</div>
                </div>
                {t.comingSoon && (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Soon
                  </span>
                )}
              </Card>
            </button>
          );
        })}

        <p className="pt-4 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          More tools coming
        </p>
      </main>
    </div>
  );
};

export default Tools;
