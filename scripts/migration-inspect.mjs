/** Offline first-pass fingerprinting only. Never executes SQL or archive members. */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function detectFormat(prefix) {
  if (prefix.subarray(0, 5).equals(Buffer.from('PGDMP'))) return 'postgres-custom-candidate';
  if (prefix[0] === 0x1f && prefix[1] === 0x8b) return 'gzip-container';
  if (prefix.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return 'zip-container';
  if (prefix.subarray(257, 262).equals(Buffer.from('ustar'))) return 'tar-container';
  if (prefix.toString('utf8').startsWith('--\n-- PostgreSQL database dump\n')) return 'postgres-plain-sql-candidate';
  return 'unknown';
}

function inside(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep));
}

export async function inspectArchive(input) {
  // Resolve before containment checks, preventing symlinks into the checkout.
  const actual = await realpath(input);
  const repo = await realpath(repository);
  if (inside(repo, actual)) throw new Error('REFUSE_REPOSITORY_INPUT');
  const parent = await stat(dirname(actual));
  if ((parent.mode & 0o077) !== 0 || parent.uid !== process.getuid()) {
    throw new Error('REFUSE_NONPRIVATE_PARENT');
  }
  const handle = await open(actual, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.uid !== process.getuid() || (before.mode & 0o077) !== 0) {
      throw new Error('REFUSE_NONPRIVATE_REGULAR_FILE');
    }
    if (before.size === 0) throw new Error('REFUSE_EMPTY_INPUT');
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(1024 * 1024);
    let prefix;
    let bytes = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (!bytesRead) break;
      if (!prefix) prefix = Buffer.from(buffer.subarray(0, Math.min(bytesRead, 512)));
      hash.update(buffer.subarray(0, bytesRead));
      bytes += bytesRead;
    }
    const after = await handle.stat();
    if (bytes !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ctimeMs !== before.ctimeMs) {
      throw new Error('REFUSE_CHANGED_INPUT');
    }
    return {
      version: 1,
      bytes,
      sha256: hash.digest('hex'),
      format: detectFormat(prefix),
      restoreAuthorized: false,
      completenessVerified: false,
      nextStep: 'Private format-specific inventory and executable-content review required; no restore command generated.',
      destinationHistoryPolicy: 'Exclude only cron.job_run_details data after structural review; preserve the original export and source history.',
    };
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) {
    process.stderr.write('Usage: bun scripts/migration-inspect.mjs /private/archive/export\n');
    process.exitCode = 1;
  } else {
    try {
      process.stdout.write(`${JSON.stringify(await inspectArchive(process.argv[2]), null, 2)}\n`);
    } catch {
      // Never echo filesystem errors, filenames, SQL, credentials, or archive content.
      process.stderr.write('Inspection refused or failed. Check a stable, nonempty, owner-only regular file and parent outside the repository.\n');
      process.exitCode = 1;
    }
  }
}
