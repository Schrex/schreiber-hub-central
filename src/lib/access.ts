import { useAuth } from "@/hooks/useAuth";
import { ACCESS_RULES, type AccessAction, type AccessRole, type Rule } from "@/lib/accessRules";

export { ACCESS_RULES, type AccessAction, type AccessRole, type Rule };

/** Who is asking. Built from useAuth by useAccess; tests construct it directly. */
export interface Viewer {
  /** Roles have loaded (useAuth `rolesLoaded`). Before that every check is false. */
  ready: boolean;
  /** Signed-in user id, or null without a session. */
  userId: string | null;
  /** Every real role held. */
  roles: readonly AccessRole[];
  /** An admin's "preview as" role; ignored for non-admins. */
  previewRole: AccessRole | null;
}

/** Facts about the job a job-foreman rule is checked against. */
export interface JobFacts {
  foremanId: string | null;
}

type RuleOf<A extends AccessAction> = (typeof ACCESS_RULES)[A];

/** Extra arguments an action needs: the job for job-foreman rules, nothing otherwise. */
export type AccessResource<A extends AccessAction> = RuleOf<A> extends { orJobForeman: true } ? [job: JobFacts] : [];

/** Actions that need no resource (usable by the route guard). */
export type PlainAccessAction = { [A in AccessAction]: AccessResource<A> extends [] ? A : never }[AccessAction];

/** Roles a check runs against: the preview role while an admin previews, else every real role. */
function effectiveRoles(viewer: Viewer, rule: Rule): readonly AccessRole[] {
  if (rule.basis === "real") return viewer.roles;
  if (viewer.previewRole && viewer.roles.includes("admin")) return [viewer.previewRole];
  return viewer.roles;
}

/** True when the viewer may perform `action`. Deny by default: not ready, no session or no roles is false. */
export function can<A extends AccessAction>(viewer: Viewer, action: A, ...resource: AccessResource<A>): boolean {
  if (!viewer.ready || !viewer.userId || viewer.roles.length === 0) return false;
  const rule: Rule | undefined = ACCESS_RULES[action];
  if (!rule) return false;
  const roles = effectiveRoles(viewer, rule);
  if (roles.some((r) => rule.roles.includes(r))) return true;
  if (!rule.orJobForeman) return false;
  // Today's UI: the job foreman exception applies to someone acting as a foreman.
  const job = (resource as [JobFacts?])[0];
  return roles.includes("foreman") && !!job?.foremanId && job.foremanId === viewer.userId;
}

/** Access checks for the signed-in user. Callers that redirect must wait for `ready`. */
export function useAccess(): { ready: boolean; can: <A extends AccessAction>(action: A, ...resource: AccessResource<A>) => boolean } {
  const { user, roles, previewRole, rolesLoaded } = useAuth();
  const viewer: Viewer = { ready: rolesLoaded, userId: user?.id ?? null, roles, previewRole };
  return { ready: rolesLoaded, can: (action, ...resource) => can(viewer, action, ...resource) };
}
