import {
  Calendar,
  FileText,
  Wrench,
  ClipboardList,
  Receipt,
  Palmtree,
  Settings,
  Briefcase,
  Truck,
  TruckIcon,
  UserPlus,
  ShoppingBag,
  HandCoins,
  Sparkles,
  Calculator,
  LogOut,
  IdCard,
  DollarSign,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/home/HeaderBar";
import { WeatherStrip } from "@/components/home/WeatherStrip";
import { AppTile } from "@/components/home/AppTile";
import { useAuth, type Role } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type Tile = {
  key: string;
  label: string;
  hint?: string;
  icon: typeof Calendar;
  roles: Role[];
  badge?: string | number;
  restricted?: "foreman" | "office" | "admin";
  to?: string;
  href?: string;
};

const TILES: Tile[] = [
  { key: "schedule", label: "Schedule", hint: "Today + this week", icon: Calendar, roles: ["employee", "foreman", "office", "admin"], to: "/schedule", badge: "Today" },
  { key: "jobs", label: "Jobs", hint: "Plans, GPS, contacts", icon: Briefcase, roles: ["employee", "foreman", "office", "admin"], to: "/jobs" },
  { key: "trucking", label: "Trucking", hint: "Today's truck orders", icon: Truck, roles: ["employee", "foreman", "office", "admin"], to: "/dispatch" },
  { key: "vendors", label: "Vendors", hint: "Suppliers + contacts", icon: Truck, roles: ["employee", "foreman", "office", "admin"], to: "/vendors" },
  { key: "employee-contacts", label: "Employee Contacts", hint: "Crew phone book", icon: Users, roles: ["employee", "foreman", "office", "admin"], to: "/employee-contacts" },
  { key: "maintenance", label: "Equipment", hint: "Log issues (HCSS)", icon: Wrench, roles: ["employee", "foreman", "office", "admin"], href: "https://mr.hcssapps.com" },
  { key: "clearstory", label: "Clearstory", hint: "CORs & RFIs", icon: ClipboardList, roles: ["foreman", "admin"], href: "https://app.clearstory.build" },
  { key: "receipts", label: "Submit Receipt", hint: "Snap & send", icon: Receipt, roles: ["employee", "foreman", "office", "admin"], href: "https://app.bill.com/" },
  { key: "perks", label: "My Perks", hint: "Apparel, time off & referrals", icon: Sparkles, roles: ["employee", "foreman", "office", "admin"], to: "/perks" },
  
  { key: "tools", label: "Tools", hint: "Calculators & utilities", icon: Calculator, roles: ["employee", "foreman", "office", "admin"], to: "/tools" },
  { key: "myposition", label: "My Position", hint: "Title, pay & range — private", icon: IdCard, roles: ["employee", "foreman", "office", "admin"], to: "/my-position" },
  { key: "newhire", label: "New Hires", hint: "Send onboarding", icon: UserPlus, roles: ["admin"] },
  { key: "positions", label: "Positions & Pay", hint: "Roles, ranges, assignments", icon: DollarSign, roles: ["admin"], to: "/admin/positions" },
  { key: "admin", label: "Admin", hint: "Users & settings", icon: Settings, roles: ["admin"], to: "/admin/users" },
];

const Index = () => {
  const { role, displayName, positionTitle, signOut } = useAuth();
  const navigate = useNavigate();
  const effectiveRole: Role = role ?? "employee";
  const visible = TILES.filter((t) => t.roles.includes(effectiveRole));

  const handleTile = (t: Tile) => {
    if (t.to) {
      navigate(t.to);
      return;
    }
    if (t.key === "receipts") {
      // Try to open the Bill.com mobile app, fall back to web after a short delay
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        const start = Date.now();
        // Bill.com iOS/Android universal link
        window.location.href = "billcom://";
        setTimeout(() => {
          // If the app didn't open (page still here), open web app
          if (Date.now() - start < 2000) {
            window.open("https://app.bill.com/", "_blank", "noopener,noreferrer");
          }
        }, 1200);
        return;
      }
      window.open("https://app.bill.com/", "_blank", "noopener,noreferrer");
      return;
    }
    if (t.href) window.open(t.href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar name={displayName ?? "there"} role={effectiveRole} positionTitle={positionTitle} />

      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-12">
        <WeatherStrip />

        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Apps
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {visible.length} available
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((t, i) => (
              <div key={t.key} className="animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <AppTile
                  icon={t.icon}
                  label={t.label}
                  hint={t.hint}
                  badge={t.badge}
                  restricted={t.restricted}
                  onClick={() => handleTile(t)}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-center pt-2">
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Schreiber Excavating · Field App
        </p>
      </main>
    </div>
  );
};

export default Index;
