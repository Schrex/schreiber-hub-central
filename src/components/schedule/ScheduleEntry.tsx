import { useEffect } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { schedulePageParked } from "@/lib/launchScope";
import Schedule from "@/pages/Schedule";

/** The Daily Schedule app; the hub forwards this path to its own Worker (#98). */
export const DAILY_SCHEDULE_URL = "/daily-schedule/";

/**
 * Leaves the hub with a real page load, so the request reaches the forwarding function instead
 * of the hub's router. `replace` drops /schedule from history: Back returns to where the link was.
 */
export function DailyScheduleRedirect() {
  useEffect(() => {
    window.location.replace(DAILY_SCHEDULE_URL);
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-sm text-muted-foreground">
      Opening the Daily Schedule…
    </main>
  );
}

/**
 * /schedule: every Schedule link (home tile, bottom menu, Job Lookahead, Whiteboard back button)
 * arrives here. While the old page is parked it opens the Daily Schedule; otherwise the old page.
 */
export function ScheduleEntry({ parked = schedulePageParked }: { parked?: boolean }) {
  if (parked) return <DailyScheduleRedirect />;
  return (
    <ProtectedRoute>
      <Schedule />
    </ProtectedRoute>
  );
}
