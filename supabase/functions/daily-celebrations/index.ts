// Daily celebrations job
// - On the day: posts an in-app announcement (notification) to ALL active users
//   for each birthday and work anniversary.
// - 7 days before & 1 day before: sends an admin-only reminder notification.
// Idempotent via the celebration_log table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// New York time "today" (matches the rest of the app)
function nyToday(): Date {
  const now = new Date();
  const ny = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  ny.setHours(0, 0, 0, 0);
  return ny;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mmdd(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function yearsBetween(from: string, to: Date): number {
  const f = new Date(from + "T00:00:00");
  let years = to.getFullYear() - f.getFullYear();
  const beforeAnniv =
    to.getMonth() < f.getMonth() ||
    (to.getMonth() === f.getMonth() && to.getDate() < f.getDate());
  if (beforeAnniv) years -= 1;
  return years;
}

interface Person {
  user_id: string;
  name: string;
  date_of_birth: string | null;
  hire_date: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require either the service-role key or a dedicated cron secret to invoke.
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CRON_SECRET = Deno.env.get("DAILY_CELEBRATIONS_SECRET");
  const auth = req.headers.get("Authorization") ?? "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim();
  const cronHeader = req.headers.get("x-cron-secret") ?? "";
  const okAuth =
    (provided && provided === SERVICE_KEY) ||
    (CRON_SECRET && (provided === CRON_SECRET || cronHeader === CRON_SECRET));
  if (!okAuth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    const today = nyToday();
    const in7 = addDays(today, 7);
    const in1 = addDays(today, 1);

    // Pull all linked, active employees with at least one date set
    const { data: contacts, error: cErr } = await sb
      .from("employee_contacts")
      .select("converted_user_id, name, date_of_birth, hire_date, is_active")
      .not("converted_user_id", "is", null)
      .eq("is_active", true);
    if (cErr) throw cErr;

    const people: Person[] = (contacts ?? [])
      .filter((c) => c.date_of_birth || c.hire_date)
      .map((c) => ({
        user_id: c.converted_user_id as string,
        name: c.name as string,
        date_of_birth: (c.date_of_birth as string | null) ?? null,
        hire_date: (c.hire_date as string | null) ?? null,
      }));

    // All active users (for global announcements)
    const { data: allProfiles, error: pErr } = await sb
      .from("profiles")
      .select("user_id")
      .eq("is_active", true);
    if (pErr) throw pErr;
    const allUserIds = (allProfiles ?? []).map((p) => p.user_id as string);

    // Admin user ids (for reminders)
    const { data: admins, error: aErr } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (aErr) throw aErr;
    const adminUserIds = Array.from(
      new Set((admins ?? []).map((r) => r.user_id as string)),
    );

    type Event = {
      person: Person;
      kind: "birthday" | "anniversary";
      stage: "reminder_7" | "reminder_1" | "announcement";
      eventDate: Date;
      years?: number;
    };
    const events: Event[] = [];

    for (const p of people) {
      const checks: { date: Date; stage: Event["stage"] }[] = [
        { date: today, stage: "announcement" },
        { date: in1, stage: "reminder_1" },
        { date: in7, stage: "reminder_7" },
      ];
      for (const c of checks) {
        const tag = mmdd(c.date);
        if (p.date_of_birth && mmdd(p.date_of_birth) === tag) {
          events.push({
            person: p,
            kind: "birthday",
            stage: c.stage,
            eventDate: c.date,
          });
        }
        if (p.hire_date && mmdd(p.hire_date) === tag) {
          const years = yearsBetween(p.hire_date, c.date);
          if (years >= 1) {
            events.push({
              person: p,
              kind: "anniversary",
              stage: c.stage,
              eventDate: c.date,
              years,
            });
          }
        }
      }
    }

    let announced = 0;
    let reminded = 0;

    for (const e of events) {
      const eventDateStr = ymd(e.eventDate);

      // Idempotency check
      const { data: existing } = await sb
        .from("celebration_log")
        .select("id")
        .eq("user_id", e.person.user_id)
        .eq("kind", e.kind)
        .eq("event_date", eventDateStr)
        .eq("stage", e.stage)
        .maybeSingle();
      if (existing) continue;

      const isAnniv = e.kind === "anniversary";
      const yrs = e.years ?? 0;

      let title = "";
      let body = "";
      if (e.stage === "announcement") {
        if (isAnniv) {
          title = `🎉 ${e.person.name} — ${yrs} year${yrs === 1 ? "" : "s"} with Schreiber!`;
          body = `Today marks ${yrs} year${yrs === 1 ? "" : "s"} since ${e.person.name} joined the team. Congrats!`;
        } else {
          title = `🎂 Happy birthday, ${e.person.name}!`;
          body = `Wish ${e.person.name} a happy birthday today.`;
        }
      } else {
        const when = e.stage === "reminder_7" ? "in 1 week" : "tomorrow";
        if (isAnniv) {
          title = `Reminder: ${e.person.name}'s ${yrs}-year work anniversary ${when}`;
          body = `${e.person.name} hits ${yrs} year${yrs === 1 ? "" : "s"} on ${eventDateStr}.`;
        } else {
          title = `Reminder: ${e.person.name}'s birthday ${when}`;
          body = `${e.person.name}'s birthday is ${eventDateStr}.`;
        }
      }

      const recipients =
        e.stage === "announcement" ? allUserIds : adminUserIds;
      if (!recipients.length) continue;

      const rows = recipients.map((uid) => ({
        user_id: uid,
        kind: isAnniv ? "anniversary" : "birthday",
        title,
        body,
        metadata: {
          stage: e.stage,
          subject_user_id: e.person.user_id,
          event_date: eventDateStr,
          years: yrs || null,
        },
      }));

      const { error: nErr } = await sb.from("notifications").insert(rows);
      if (nErr) {
        console.error("notification insert failed", nErr);
        continue;
      }

      await sb.from("celebration_log").insert({
        user_id: e.person.user_id,
        kind: e.kind,
        event_date: eventDateStr,
        stage: e.stage,
      });

      if (e.stage === "announcement") announced += 1;
      else reminded += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        today: ymd(today),
        events_processed: events.length,
        announced,
        reminded,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("daily-celebrations error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
