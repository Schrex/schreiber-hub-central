import { describe, expect, it } from 'vitest';
import { ACCESS_RULES, can, type Rule, type Viewer } from '@/lib/access';

const viewer = (roles: Viewer['roles'], extra: Partial<Viewer> = {}): Viewer => ({
  ready: true, userId: 'synthetic-user', roles, previewRole: null, ...extra,
});

describe('deny by default', () => {
  it('denies when roles have not loaded', () => {
    expect(can(viewer(['admin'], { ready: false }), 'admin.open')).toBe(false);
  });
  it('denies without a session or without roles', () => {
    expect(can(viewer(['admin'], { userId: null }), 'admin.open')).toBe(false);
    expect(can(viewer([]), 'admin.open')).toBe(false);
  });
  it('allows an admin into the admin area', () => {
    expect(can(viewer(['admin']), 'admin.open')).toBe(true);
  });
});

// Expected allow-list per action, written from today's inline checks + spec #43 decisions.
// E = employee, F = foreman, O = office, A = admin.
const EXPECTED: Record<string, string> = {
  'preview.switch': 'A',
  'admin.open': 'A',
  'clearstory.open': 'FA',
  'tools.open': 'FOA',
  'jobs.edit': 'OA',
  'jobs.private.view': 'FOA',
  'jobs.report.view': 'F',
  'job.contacts.edit': 'OA',
  'job.digTickets.edit': 'OA',
  'job.permits.edit': 'OA',
  'job.plans.edit': 'OA',
  'job.files.view': 'EFOA',
  'job.photos.edit': 'FOA',
  'job.submittals.view': 'FOA',
  'job.submittals.edit': 'OA',
  'job.swppp.edit': 'OA',
  'job.scope.edit': 'OA',
  'job.brief.edit': 'OA',
  'job.contract.view': 'OA',
  'job.contract.edit': 'OA',
  'job.estimates.edit': 'OA',
  'job.inspection.request': 'O',
  'trucks.request': 'FOA',
  'dispatch.edit': 'OA',
  'schedule.edit': 'OA',
  'schedule.notes.edit': 'FOA',
  'whiteboard.use': 'FOA',
  'employeeContacts.edit': 'OA',
  'employeeContacts.convert': 'A',
  'vendors.edit': 'FOA',
  'vendors.delete': 'OA',
  'safety.manage': 'A',
  'safety.sessions.run': 'FA',
  'safety.violation.report': 'FOA',
  'timeOff.approve': 'A',
  'positions.pay.view': 'A',
  'reviews.manage': 'OA',
  'handbook.manage': 'OA',
  'referrals.manage': 'OA',
  'apparel.manage': 'OA',
  'shopBooking.manage': 'OA',
  'equipmentRental.manage': 'OA',
};
const LETTER = { employee: 'E', foreman: 'F', office: 'O', admin: 'A' } as const;
const ALL_ROLES = ['employee', 'foreman', 'office', 'admin'] as const;
const NO_JOB = { foremanId: 'someone-else' };
// The matrix loops over strings; resource-taking actions get an unrelated job.
const check = (v: Viewer, action: string) =>
  (can as (v: Viewer, a: string, ...r: unknown[]) => boolean)(v, action, NO_JOB);

describe('rule matrix', () => {
  it('covers every rule and nothing else', () => {
    expect(Object.keys(ACCESS_RULES).sort()).toEqual(Object.keys(EXPECTED).sort());
  });
  for (const [action, allowed] of Object.entries(EXPECTED)) {
    for (const role of ALL_ROLES) {
      const expected = allowed.includes(LETTER[role]);
      it(`${action}: ${role} ${expected ? 'allowed' : 'denied'}`, () => {
        expect(check(viewer([role]), action)).toBe(expected);
      });
    }
  }
  it('names an RLS mirror or ui-only for every rule', () => {
    for (const rule of Object.values(ACCESS_RULES) as Rule[]) {
      expect(rule.rls === 'ui-only' || rule.rls.length > 0).toBe(true);
    }
  });
  it('marks dig tickets, permits and plans as deliberately narrower than RLS', () => {
    for (const a of ['job.digTickets.edit', 'job.permits.edit', 'job.plans.edit'] as const) {
      expect((ACCESS_RULES[a] as Rule).narrower).toBeTruthy();
    }
  });
});

describe('preview', () => {
  const previewing = (role: Viewer['previewRole']) => viewer(['admin'], { previewRole: role });
  it('checks the preview role, hiding the admin area', () => {
    expect(can(previewing('employee'), 'admin.open')).toBe(false);
    expect(can(previewing('foreman'), 'jobs.report.view')).toBe(true);
    expect(can(previewing('office'), 'job.inspection.request')).toBe(true);
    expect(can(previewing('office'), 'safety.manage')).toBe(false);
  });
  it('keeps the role switcher on the real role so the admin can exit preview', () => {
    expect(can(previewing('employee'), 'preview.switch')).toBe(true);
  });
  it('ignores a preview role held by a non-admin', () => {
    expect(can(viewer(['foreman'], { previewRole: 'employee' }), 'trucks.request')).toBe(true);
    expect(can(viewer(['employee'], { previewRole: 'admin' }), 'admin.open')).toBe(false);
  });
});

describe('multi-role', () => {
  it('passes when any role held is allowed, like has_role()', () => {
    expect(can(viewer(['admin', 'foreman']), 'jobs.report.view')).toBe(true);
    expect(can(viewer(['admin', 'office']), 'job.inspection.request')).toBe(true);
    expect(can(viewer(['office', 'foreman']), 'safety.sessions.run')).toBe(true);
    expect(can(viewer(['employee', 'foreman']), 'admin.open')).toBe(false);
  });
});

describe('not ready', () => {
  it('denies every action until roles load', () => {
    for (const action of Object.keys(EXPECTED)) {
      expect(check(viewer(['admin'], { ready: false }), action)).toBe(false);
    }
  });
});

describe('job foreman', () => {
  const mine = { foremanId: 'synthetic-user' };
  it("lets a foreman edit contacts only on the job they're assigned to", () => {
    expect(can(viewer(['foreman']), 'job.contacts.edit', mine)).toBe(true);
    expect(can(viewer(['foreman']), 'job.contacts.edit', NO_JOB)).toBe(false);
    expect(can(viewer(['foreman']), 'job.contacts.edit', { foremanId: null })).toBe(false);
  });
  it('requires someone acting as a foreman', () => {
    expect(can(viewer(['employee']), 'job.contacts.edit', mine)).toBe(false);
    expect(can(viewer(['admin'], { previewRole: 'employee' }), 'job.contacts.edit', mine)).toBe(false);
    expect(can(viewer(['admin'], { previewRole: 'foreman' }), 'job.contacts.edit', mine)).toBe(true);
  });
  it('does not extend other rules to the job foreman', () => {
    expect(check(viewer(['foreman']), 'job.digTickets.edit')).toBe(false);
  });
});

describe('compile-time guards', () => {
  it('rejects unknown actions and missing job facts', () => {
    const v = viewer(['admin']);
    // @ts-expect-error unknown action
    expect(can(v, 'jobs.fly')).toBe(false);
    // @ts-expect-error job-foreman rule needs the job
    expect(can(v, 'job.contacts.edit')).toBe(true);
  });
});
