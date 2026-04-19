import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  label: string;
  hint?: string;
  badge?: string | number;
  restricted?: "foreman" | "office" | "admin";
  onClick?: () => void;
}

const restrictedColor = {
  foreman: "bg-role-foreman/15 text-role-foreman ring-1 ring-role-foreman/40",
  office: "bg-role-office/15 text-role-office ring-1 ring-role-office/40",
  admin: "bg-role-admin/15 text-role-admin ring-1 ring-role-admin/40",
} as const;

export const AppTile = ({ icon: Icon, label, hint, badge, restricted, onClick }: Props) => (
  <button
    onClick={onClick}
    className={cn(
      "group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border",
      "bg-gradient-tile p-4 text-left shadow-tile transition-all",
      "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-tile-hover active:translate-y-0",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    )}
  >
    {/* corner accent */}
    <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rotate-12 pattern-hivis opacity-[0.08] transition-opacity group-hover:opacity-20" />

    <div className="flex w-full items-start justify-between">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </div>
      {badge != null && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
          {badge}
        </span>
      )}
    </div>

    <div className="min-w-0">
      <p className="font-display text-lg uppercase leading-tight tracking-wide text-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>

    {restricted && (
      <span
        className={cn(
          "absolute bottom-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
          restrictedColor[restricted],
        )}
      >
        {restricted}
      </span>
    )}
  </button>
);
