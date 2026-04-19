import { useState } from "react";
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
  UserPlus,
} from "lucide-react";
import { HeaderBar } from "@/components/home/HeaderBar";
import { WeatherStrip } from "@/components/home/WeatherStrip";
import { AppTile } from "@/components/home/AppTile";
import { RoleSwitcher, type Role } from "@/components/home/RoleSwitcher";

type Tile = {
  key: string;
  label: string;
  hint?: string;
  icon: typeof Calendar;
  roles: Role[];
  badge?: string | number;
  restricted?: "foreman" | "office" | "admin";
};

const TILES: Tile[] = [
  { key: "schedule", label: "Schedule", hint: "Today + this week", icon: Calendar, roles: ["employee", "foreman", "office", "admin"], badge: "Today" },
  { key: "jobs", label: "Jobs", hint: "Plans, GPS, contacts", icon: Briefcase, roles: ["employee", "foreman", "office", "admin"] },
  { key: "vendors", label: "Vendors", hint: "Suppliers + map", icon: Truck, roles: ["employee", "foreman", "office", "admin"] },
  { key: "maintenance", label: "Equipment", hint: "Log issues (HCSS)", icon: Wrench, roles: ["employee", "foreman", "office", "admin"] },
  { key: "clearstory", label: "Clearstory", hint: "CORs & RFIs", icon: ClipboardList, roles: ["foreman", "admin"], restricted: "foreman" },
  { key: "receipts", label: "Submit Receipt", hint: "Snap & send", icon: Receipt, roles: ["employee", "foreman", "office", "admin"] },
  { key: "timeoff", label: "Time Off", hint: "Request vacation", icon: Palmtree, roles: ["employee", "foreman", "office", "admin"] },
  { key: "plans", label: "Project Plans", hint: "Latest drawings", icon: FileText, roles: ["employee", "foreman", "office", "admin"], badge: 3 },
  { key: "newhire", label: "New Hires", hint: "Send onboarding", icon: UserPlus, roles: ["office", "admin"], restricted: "office" },
  { key: "admin", label: "Admin", hint: "Users & settings", icon: Settings, roles: ["admin"], restricted: "admin" },
];

const NAMES: Record<Role, string> = {
  employee: "Tyler",
  foreman: "Mike",
  office: "Sarah",
  admin: "Dan",
};

const Index = () => {
  const [role, setRole] = useState<Role>("foreman");
  const visible = TILES.filter((t) => t.roles.includes(role));

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar name={NAMES[role]} role={role} />

      <main className="mx-auto max-w-2xl space-y-5 px-4 pb-12">
        <WeatherStrip />

        <RoleSwitcher value={role} onChange={setRole} />

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
                />
              </div>
            ))}
          </div>
        </section>

        <p className="pt-4 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Schreiber Excavating · Field App
        </p>
      </main>
    </div>
  );
};

export default Index;
