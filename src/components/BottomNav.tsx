import { Briefcase, Calendar, TruckIcon, Palmtree, Home } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "home", label: "Home", icon: Home, to: "/" },
  { key: "jobs", label: "Jobs", icon: Briefcase, to: "/jobs" },
  { key: "schedule", label: "Schedule", icon: Calendar, to: "/schedule" },
  { key: "dispatch", label: "Dispatch", icon: TruckIcon, to: "/dispatch" },
  { key: "timeoff", label: "Time Off", icon: Palmtree, to: "/time-off" },
];

export const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      {/* spacer so content doesn't hide behind the fixed bar */}
      <div className="h-20" aria-hidden />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/" ? pathname === "/" : pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <li key={item.key} className="flex-1">
                <button
                  onClick={() => navigate(item.to)}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};
