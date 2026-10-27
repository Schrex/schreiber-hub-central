/**
 * The pure access decision shared by `can()` (./access.ts) and scripts/local-access-policy.mjs.
 *
 * Type-only imports, so Node can load it directly (types are stripped at runtime).
 */
import type { AccessRole, Rule } from "./accessRules";

/** Who is asking, once roles have loaded. */
export interface DecisionViewer {
  /** Signed-in user id, or null without a session. */
  userId: string | null;
  /** Every real role held. */
  roles: readonly AccessRole[];
  /** An admin's "preview as" role; ignored for non-admins. */
  previewRole: AccessRole | null;
}

/** Roles shown while previewing: the preview role for an admin, else every real role (order kept). */
export function previewedRoles(roles: readonly AccessRole[], previewRole: AccessRole | null): readonly AccessRole[] {
  return previewRole && roles.includes("admin") ? [previewRole] : roles;
}

/** True when `rule` lets the viewer through. Deny by default: no session or no roles is false. */
export function decide(rule: Rule | undefined, viewer: DecisionViewer, job?: { foremanId: string | null }): boolean {
  if (!rule || !viewer.userId || viewer.roles.length === 0) return false;
  const roles = rule.basis === "real" ? viewer.roles : previewedRoles(viewer.roles, viewer.previewRole);
  if (roles.some((r) => rule.roles.includes(r))) return true;
  if (!rule.orJobForeman) return false;
  // Today's UI: the job foreman exception applies to someone acting as a foreman.
  return roles.includes("foreman") && !!job?.foremanId && job.foremanId === viewer.userId;
}
