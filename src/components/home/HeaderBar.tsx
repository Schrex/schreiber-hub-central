import { Bell } from "lucide-react";
import type { Role } from "./RoleSwitcher";
import logo from "@/assets/schreiber-logo.png";

const roleLabel: Record<Role, string> = {
  employee: "Employee",
  foreman: "Foreman",
  office: "Office",
  admin: "Admin",
};

const roleColor: Record<Role, string> = {
  employee: "bg-role-employee",
  foreman: "bg-role-foreman",
  office: "bg-role-office",
  admin: "bg-role-admin",
};

interface Props {
  name: string;
  role: Role;
}

export const HeaderBar = ({ name, role }: Props) => (
  <header className="bg-gradient-header">
    <div className="mx-auto flex max-w-2xl items-center justify-between px-4 pb-5 pt-6">
      <div className="flex items-center">
        <img
          src={logo}
          alt="Schreiber Excavating"
          className="h-12 w-auto object-contain"
        />
      </div>

      <button
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:bg-surface-elevated"
      >
        <Bell className="h-5 w-5" strokeWidth={2.25} />
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
      </button>
    </div>

    <div className="mx-auto max-w-2xl px-4 pb-6">
      <p className="text-sm text-muted-foreground">Welcome back,</p>
      <div className="mt-1 flex items-center gap-2">
        <h1 className="font-display text-3xl uppercase tracking-wide text-foreground">{name}</h1>
        <span className={`inline-flex items-center gap-1.5 rounded-full ${roleColor[role]}/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground ring-1 ring-inset ring-${role === 'employee' ? 'role-employee' : role === 'foreman' ? 'role-foreman' : role === 'office' ? 'role-office' : 'role-admin'}/40`}>
          <span className={`h-1.5 w-1.5 rounded-full ${roleColor[role]}`} />
          {roleLabel[role]}
        </span>
      </div>
    </div>
  </header>
);
