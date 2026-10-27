import type { Role } from "@/hooks/useAuth";

export interface NoticePolicy {
  days: number;
  text: string;
}

const EMPLOYEE_NOTICE: NoticePolicy = { days: 14, text: "Employees are expected to give at least 2 weeks' notice" };
const NOTICE_POLICY: Record<Role, NoticePolicy> = {
  employee: EMPLOYEE_NOTICE,
  foreman: { days: 28, text: "Foremen are expected to give at least 4 weeks' notice" },
  office: EMPLOYEE_NOTICE,
  admin: EMPLOYEE_NOTICE,
};

/**
 * Time off notice period for the role the page is shown as (useAuth `effectiveRole`, so an
 * admin previewing as foreman sees the foreman period). A business rule, not an access check.
 */
export function noticeFor(role: Role | null): NoticePolicy {
  return NOTICE_POLICY[role ?? "employee"];
}
