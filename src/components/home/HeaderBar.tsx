import type { Role } from "./RoleSwitcher";
import logo from "@/assets/schreiber-logo.png";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";

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
  positionTitle?: string | null;
}

const roleRing: Record<Role, string> = {
  employee: "ring-role-employee/40",
  foreman: "ring-role-foreman/40",
  office: "ring-role-office/40",
  admin: "ring-role-admin/40",
};

export const HeaderBar = ({ name, role, positionTitle }: Props) => (
  <header className="bg-gradient-header">
    <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pb-5 pt-6">
      <div className="flex min-w-0 items-center">
        <img
          src={logo}
          alt="Schreiber Excavating"
          className="h-12 w-auto object-contain"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full ${roleColor[role]}/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground ring-1 ring-inset ${roleRing[role]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${roleColor[role]}`} />
          {roleLabel[role]}
        </span>
        <NotificationsBell />
      </div>
    </div>

    <div className="mx-auto max-w-2xl px-4 pb-6">
      <p className="text-sm text-muted-foreground">Welcome back,</p>
      <h1 className="mt-1 font-display text-3xl uppercase tracking-wide text-foreground">{name}</h1>
      {positionTitle && (
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {positionTitle}
        </p>
      )}
    </div>
  </header>
);
