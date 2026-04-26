import {
  Briefcase,
  Calendar,
  Home,
  Sparkles,
  Wrench,
  IdCard,
  Receipt,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Custom dump truck icon (Lucide doesn't ship one)
const DumpTruck = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    {/* tilted dump bed */}
    <path d="M3 13 L14 7 L16 12 L5 12 Z" />
    {/* cab */}
    <path d="M14 13 h5 l2 3 v2 h-7 z" />
    {/* chassis line */}
    <path d="M3 16 h18" />
    {/* wheels */}
    <circle cx="8" cy="18" r="1.6" />
    <circle cx="17" cy="18" r="1.6" />
  </svg>
);

type Item = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  href?: string;
  match?: string[]; // additional path prefixes that should mark active
};

const ITEMS: Item[] = [
  { key: "home", label: "Home", icon: Home, to: "/" },
  { key: "jobs", label: "Jobs", icon: Briefcase, to: "/jobs" },
  { key: "schedule", label: "Schedule", icon: Calendar, to: "/schedule" },
  { key: "trucking", label: "Trucking", icon: DumpTruck, to: "/dispatch" },
  { key: "perks", label: "Perks", icon: Sparkles, to: "/perks", match: ["/time-off", "/apparel", "/referrals"] },
  { key: "tools", label: "Tools", icon: Wrench, to: "/tools", match: ["/tools/performance-reviews", "/tools/handbook", "/tools/trucking"] },
  { key: "position", label: "Position", icon: IdCard, to: "/my-position" },
  { key: "receipts", label: "Receipts", icon: Receipt },
];

const openDivvy = () => {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const start = Date.now();
    window.location.href = "divvy://";
    setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.open("https://app.divvy.co/", "_blank", "noopener,noreferrer");
      }
    }, 1200);
    return;
  }
  window.open("https://app.divvy.co/", "_blank", "noopener,noreferrer");
};

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
        <ul
          className="flex items-stretch overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/"
                ? pathname === "/"
                : item.to
                  ? pathname === item.to ||
                    pathname.startsWith(item.to + "/") ||
                    (item.match?.some(
                      (m) => pathname === m || pathname.startsWith(m + "/"),
                    ) ?? false)
                  : false;
            const handleClick = () => {
              if (item.key === "receipts") openDivvy();
              else if (item.to) navigate(item.to);
              else if (item.href) window.open(item.href, "_blank", "noopener,noreferrer");
            };
            return (
              <li key={item.key} className="shrink-0">
                <button
                  onClick={handleClick}
                  className={cn(
                    "flex w-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[9px] font-semibold uppercase tracking-tight transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", active && "stroke-[2.5]")} />
                  <span className="block w-full truncate text-center leading-none">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
};
