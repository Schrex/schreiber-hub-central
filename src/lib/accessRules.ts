/**
 * UI access rules: one entry per distinct gating decision.
 *
 * Pure data with no imports, so scripts/*.mjs can load it to check rules against RLS.
 * UI gating only: RLS + has_role() stay the authority. Logic lives in ./access.ts.
 */

/** Mirrors `app_role` (and `Role` in hooks/useAuth). */
export type AccessRole = "employee" | "foreman" | "office" | "admin";

export interface RlsCheck {
  table: string;
  cmd: "select" | "insert" | "update" | "delete";
}

export interface Rule {
  /** Explicit role set; never rank arithmetic. Any role held passes (matches has_role()). */
  roles: readonly AccessRole[];
  /** Also allowed when the viewer is the job's assigned foreman (jobs.foreman_id). */
  orJobForeman?: true;
  /** Check the real roles, ignoring an admin's preview. */
  basis?: "real";
  /** RLS policies this rule mirrors, or "ui-only" when nothing in the database matches it. */
  rls: readonly RlsCheck[] | "ui-only";
  /** Documented reason the UI is deliberately stricter than RLS. */
  narrower?: string;
}

const OFFICE = ["office", "admin"] as const;
const FIELD = ["foreman", "office", "admin"] as const;

const writes = (table: string, ...cmds: RlsCheck["cmd"][]): RlsCheck[] =>
  (cmds.length ? cmds : (["insert", "update", "delete"] as const)).map((cmd) => ({ table, cmd }));

export const ACCESS_RULES = {
  // Admin area and preview
  "preview.switch": { roles: ["admin"], basis: "real", rls: "ui-only" },
  /** /hr, /admin/* routes and their home tiles. Hidden while previewing. */
  "admin.open": { roles: ["admin"], rls: "ui-only" },

  // Home tiles (external links / unguarded routes)
  "clearstory.open": { roles: ["foreman", "admin"], rls: "ui-only" },
  "tools.open": { roles: FIELD, rls: "ui-only" },

  // Jobs
  /** Create a job, assign its foreman, change its status. */
  "jobs.edit": { roles: OFFICE, rls: writes("jobs") },
  /** Upload and publish a task look-ahead. Office and admin only. */
  "lookahead.upload": { roles: OFFICE, rls: writes("lookahead_plans") },
  /** Customer, brief, contacts and other non-crew job details. */
  "jobs.private.view": { roles: FIELD, rls: "ui-only" },
  "jobs.report.view": { roles: ["foreman"], rls: "ui-only" },
  "job.contacts.edit": { roles: OFFICE, orJobForeman: true, rls: writes("job_contacts") },
  "job.digTickets.edit": {
    roles: OFFICE,
    rls: writes("dig_tickets"),
    narrower: "Dig tickets stay office/admin in the UI; RLS also allows foreman.",
  },
  "job.permits.edit": {
    roles: OFFICE,
    rls: writes("job_permits"),
    narrower: "Permits stay office/admin in the UI; RLS (table and permits bucket) also allows foreman.",
  },
  "job.plans.edit": {
    roles: OFFICE,
    rls: writes("job_plans"),
    narrower: "Plans stay office/admin in the UI; RLS (table and job-plans bucket) also allows foreman.",
  },
  /** Plans, photos, permits and SWPPP in the job file list: any signed-in role. */
  "job.files.view": { roles: ["employee", ...FIELD], rls: "ui-only" },
  "job.photos.edit": { roles: FIELD, rls: writes("job_photos") },
  "job.submittals.view": { roles: FIELD, rls: "ui-only" },
  "job.submittals.edit": { roles: OFFICE, rls: writes("job_submittals") },
  "job.swppp.edit": { roles: OFFICE, rls: writes("swpppp_reports") },
  "job.scope.edit": { roles: OFFICE, rls: writes("job_scope_items") },
  "job.brief.edit": { roles: OFFICE, rls: writes("jobs", "update") },
  "job.contract.view": { roles: OFFICE, rls: "ui-only" },
  "job.contract.edit": { roles: OFFICE, rls: writes("jobs", "update") },
  "job.estimates.edit": { roles: OFFICE, rls: writes("job_estimates") },
  /** Office only (admin excluded); sent through the request-safety-inspection Edge function. */
  "job.inspection.request": { roles: ["office"], rls: "ui-only" },

  // Trucking and dispatch
  "trucks.request": { roles: FIELD, rls: writes("truck_requests", "insert") },
  "dispatch.edit": {
    roles: OFFICE,
    rls: [...writes("dispatch_orders"), ...writes("truck_requests", "update", "delete")],
    narrower: "Dispatch orders stay office/admin in the UI; RLS also allows foreman.",
  },

  // Schedule
  "schedule.edit": {
    roles: OFFICE,
    rls: writes("schedule_assignments"),
    narrower: "Crew assignment stays office/admin in the UI; RLS also allows foreman for future days.",
  },
  "schedule.notes.edit": { roles: FIELD, rls: writes("schedule_assignments", "update") },
  "whiteboard.use": { roles: FIELD, rls: writes("whiteboard_tiles") },

  // Directories
  /** Add, edit and delete employee contacts (follows RLS: office/admin). */
  "employeeContacts.edit": { roles: OFFICE, rls: writes("employee_contacts") },
  /** Create a login from a contact (convert-employee-contact Edge function). */
  "employeeContacts.convert": { roles: ["admin"], rls: "ui-only" },
  "vendors.edit": { roles: FIELD, rls: writes("vendors", "insert", "update") },
  "vendors.delete": { roles: OFFICE, rls: writes("vendors", "delete") },

  // Safety
  /** Rules, toolbox talks and safety settings. */
  "safety.manage": { roles: ["admin"], rls: [...writes("safety_rules"), ...writes("toolbox_talks")] },
  /** Run toolbox-talk sessions (office excluded). */
  "safety.sessions.run": { roles: ["foreman", "admin"], rls: writes("toolbox_talk_sessions", "insert") },
  "safety.violation.report": { roles: FIELD, rls: writes("safety_violations", "insert") },

  // HR and perks
  "timeOff.approve": { roles: ["admin"], rls: writes("time_off_requests", "update", "delete") },
  /** Pay ranges and holders on My Position. */
  "positions.pay.view": { roles: ["admin"], rls: "ui-only" },
  "reviews.manage": { roles: OFFICE, rls: writes("performance_reviews") },
  "handbook.manage": { roles: OFFICE, rls: writes("handbook_documents") },
  "referrals.manage": { roles: OFFICE, rls: writes("referrals", "update", "delete") },
  "apparel.manage": { roles: OFFICE, rls: [...writes("clothing_items"), ...writes("clothing_orders", "update", "delete")] },
  "shopBooking.manage": { roles: OFFICE, rls: writes("shop_reservations", "update", "delete") },
  "equipmentRental.manage": {
    roles: OFFICE,
    rls: [...writes("equipment_items"), ...writes("equipment_rentals", "update", "delete")],
  },
} as const satisfies Record<string, Rule>;

export type AccessAction = keyof typeof ACCESS_RULES;
