import { cn } from "@/lib/utils";

export type Role = "employee" | "foreman" | "office" | "admin";

const ROLES: { id: Role; label: string }[] = [
  { id: "employee", label: "Employee" },
  { id: "foreman", label: "Foreman" },
  { id: "office", label: "Office" },
  { id: "admin", label: "Admin" },
];

interface Props {
  value: Role;
  onChange: (r: Role) => void;
}

export const RoleSwitcher = ({ value, onChange }: Props) => (
  <div className="rounded-xl border border-border bg-surface/60 p-2">
    <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      Preview as role
    </p>
    <div className="grid grid-cols-4 gap-1">
      {ROLES.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onChange(r.id)}
            className={cn(
              "rounded-lg px-2 py-2 text-xs font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-tile"
                : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  </div>
);
