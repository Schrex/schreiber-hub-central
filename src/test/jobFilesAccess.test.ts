import { describe, expect, it, vi } from 'vitest';
import { can, type Viewer } from '@/lib/access';
import { visibleFileSources } from '@/components/jobs/jobFiles';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const viewer = (roles: Viewer['roles'], extra: Partial<Viewer> = {}): Viewer => ({
  ready: true, userId: 'synthetic-user', roles, previewRole: null, ...extra,
});
const sources = (v: Viewer) => visibleFileSources((action) => can(v, action));
const BASE = ['Plans', 'Photos', 'Permits', 'SWPPP'];

describe('visible job file sources', () => {
  it.each([
    [['employee'], BASE],
    [['foreman'], [...BASE, 'Submittals']],
    [['office'], [...BASE, 'Submittals', 'Contract']],
    [['admin'], [...BASE, 'Submittals', 'Contract']],
  ] as [Viewer['roles'], string[]][])('%s sees %s', (roles, expected) => {
    expect(sources(viewer(roles))).toEqual(expected);
  });
  it('shows nothing before roles load or without roles', () => {
    expect(sources(viewer(['admin'], { ready: false }))).toEqual([]);
    expect(sources(viewer([]))).toEqual([]);
  });
  it('honours an admin preview', () => {
    expect(sources(viewer(['admin'], { previewRole: 'employee' }))).toEqual(BASE);
  });
  it('uses any role held', () => {
    expect(sources(viewer(['employee', 'office']))).toEqual([...BASE, 'Submittals', 'Contract']);
  });
});
