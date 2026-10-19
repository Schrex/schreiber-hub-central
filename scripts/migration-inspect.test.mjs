import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { detectFormat, inspectArchive } from './migration-inspect.mjs';

let root;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'migration-synthetic-')); await chmod(root, 0o700); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
async function fixture(content, mode = 0o600) {
  const path = join(root, 'fixture');
  await writeFile(path, content, { mode });
  return path;
}
describe('offline migration inspection', () => {
  it('hashes every byte and emits neither path nor synthetic sensitive content', async () => {
    const content = Buffer.from(`--\n-- PostgreSQL database dump\n${'synthetic-password-hash\n'.repeat(100000)}`);
    const result = await inspectArchive(await fixture(content));
    expect(result.sha256).toBe(createHash('sha256').update(content).digest('hex'));
    expect(result.bytes).toBe(content.length);
    expect(result.format).toBe('postgres-plain-sql-candidate');
    expect(result.restoreAuthorized).toBe(false);
    expect(result.completenessVerified).toBe(false);
    expect(JSON.stringify(result)).not.toContain('synthetic-password-hash');
    expect(JSON.stringify(result)).not.toContain(root);
  });
  it.each([
    [Buffer.from('PGDMP'), 'postgres-custom-candidate'],
    [Buffer.from([0x1f, 0x8b]), 'gzip-container'],
    [Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'zip-container'],
    [Buffer.from('arbitrary SQL SELECT 1;'), 'unknown'],
  ])('classifies bytes without trusting names or executing contents', (bytes, format) => {
    expect(detectFormat(bytes)).toBe(format);
  });
  it('identifies a tar signature without extracting members', () => {
    const header = Buffer.alloc(512); header.write('ustar', 257);
    expect(detectFormat(header)).toBe('tar-container');
  });
  it('refuses an empty file', async () => {
    await expect(inspectArchive(await fixture(''))).rejects.toThrow('REFUSE_EMPTY_INPUT');
  });
  it('refuses a group-readable export', async () => {
    const path = await fixture('synthetic'); await chmod(path, 0o640);
    await expect(inspectArchive(path)).rejects.toThrow('REFUSE_NONPRIVATE_REGULAR_FILE');
  });
  it('refuses a shared parent', async () => {
    const path = await fixture('synthetic'); await chmod(root, 0o750);
    await expect(inspectArchive(path)).rejects.toThrow('REFUSE_NONPRIVATE_PARENT');
  });
  it('refuses a repository file reached through a symlink', async () => {
    const path = join(root, 'linked'); await symlink(new URL('../package.json', import.meta.url), path);
    await expect(inspectArchive(path)).rejects.toThrow('REFUSE_REPOSITORY_INPUT');
  });
});
