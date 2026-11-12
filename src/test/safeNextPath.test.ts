import { describe, expect, it } from 'vitest';
import { safeNextPath, signInPath } from '@/lib/safeNextPath';

describe('safeNextPath', () => {
  it('follows a path inside the Hub, keeping its query string', () => {
    expect(safeNextPath('/time-off?request=abc-123')).toBe('/time-off?request=abc-123');
    expect(safeNextPath('/admin/users')).toBe('/admin/users');
  });

  it.each([
    'https://evil.example.test/time-off',
    'http://evil.example.test',
    '//evil.example.test/time-off',
    '/\\evil.example.test',
    '\\\\evil.example.test',
    '/\t/evil.example.test',
    ' //evil.example.test',
    'javascript:alert(1)',
    'time-off',
    '',
  ])('refuses %j and goes home', (raw) => {
    expect(safeNextPath(raw)).toBe('/');
  });

  it('goes home when nothing was requested or the target is sign-in itself', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('/auth?next=/time-off')).toBe('/');
  });
});

describe('signInPath', () => {
  it('carries the requested path and query to sign-in', () => {
    expect(signInPath('/time-off', '?request=abc-123')).toBe('/auth?next=%2Ftime-off%3Frequest%3Dabc-123');
  });

  it('sends plain sign-in when the request was home', () => {
    expect(signInPath('/', '')).toBe('/auth');
  });
});
