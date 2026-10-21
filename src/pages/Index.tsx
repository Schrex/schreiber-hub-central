import { independentLaunch } from "@/lib/launchScope";
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
  HardHat,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/home/HeaderBar";
import { WeatherStrip } from "@/components/home/WeatherStrip";
import { AppTile } from "@/components/home/AppTile";
import { RoleSwitcher } from "@/components/home/RoleSwitcher";
import { CelebrationsBanner } from "@/components/home/CelebrationsBanner";
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
  { key: "receipts", label: "Submit Receipt", hint: "Bill Spend & Expense", icon: Receipt, roles: ["employee", "foreman", "office", "admin"], href: "https://app.divvy.co/" },
  { key: "perks", label: "My Perks", hint: "Apparel, time off & referrals", icon: Sparkles, roles: ["employee", "foreman", "office", "admin"], to: "/perks" },
  
  { key: "tools", label: "Tools", hint: "Calculators & utilities", icon: Calculator, roles: ["foreman", "office", "admin"], to: "/tools" },
  { key: "safety", label: "Safety", hint: "Rules & toolbox talks", icon: HardHat, roles: ["employee", "foreman", "office", "admin"], to: "/safety" },
  { key: "myposition", label: "My Position", hint: "Title, pay & range — private", icon: IdCard, roles: ["employee", "foreman", "office", "admin"], to: "/my-position" },
  { key: "hr", label: "HR", hint: "Reviews, pay, time off, contacts & new hires", icon: Briefcase, roles: ["admin"], to: "/hr" },
  { key: "admin", label: "Admin", hint: "Users & settings", icon: Settings, roles: ["admin"], to: "/admin/users" },
];

const Index = () => {
  const { role, effectiveRole: ctxRole, setPreviewRole, displayName, positionTitle, signOut } = useAuth();
  const navigate = useNavigate();
  const effectiveRole: Role = ctxRole ?? "employee";
  const visible = TILES.filter((t) => t.roles.includes(effectiveRole));

  const handleTile = (t: Tile) => {
    if (t.to) {
      navigate(t.to);
      return;
    }
    if (t.key === "receipts") {
      // Try to open the Bill Spend & Expense (Divvy) mobile app, fall back to web
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
      return;
    }
    if (t.href) window.open(t.href, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar name={displayName ?? "there"} role={effectiveRole} positionTitle={positionTitle} />

      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-12">
        <WeatherStrip />
        {!independentLaunch && <CelebrationsBanner />}

        {role === "admin" && (
          <RoleSwitcher value={effectiveRole} onChange={setPreviewRole} />
        )}

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
