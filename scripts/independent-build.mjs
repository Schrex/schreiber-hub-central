// Internal builder: inputs arrive on stdin, never command arguments or .env files.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceProject = 'bitogpfplcquovpdjprk';

export function validateDestination({ project, url, key } = {}) {
  if (typeof project !== 'string' || !/^[a-z]{20}$/.test(project) || project === sourceProject) {
    throw new Error('Specify a non-source destination project reference.');
  }
  if (url !== `https://${project}.supabase.co`) throw new Error('Destination URL must match the explicit project.');
  try {
    const parts = key.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (claims.role !== 'anon' || claims.ref !== project) throw new Error();
    if (claims.exp !== undefined && (!Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000)) throw new Error();
  } catch {
    throw new Error('Use the destination legacy anon key; privileged, opaque, expired and wrong-project keys are rejected.');
  }
  // This is an accidental-key guard, not cryptographic verification. Supabase
  // verifies the signature when an authorized browser accesses the destination.
  return {
    VITE_SUPABASE_URL: url,
    VITE_SUPABASE_PROJECT_ID: project,
    VITE_SUPABASE_PUBLISHABLE_KEY: key,
    VITE_INDEPENDENT_LAUNCH: 'true',
    VITE_REHEARSAL_BACKEND: 'false',
    VITE_LOCAL_BACKEND: 'false',
  };
}

export function isolateEnvironment(env, client) {
  const clean = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SYSTEMROOT'].filter(name => env[name]).map(name => [name, env[name]]));
  return { ...clean, NODE_ENV: 'production', ...client };
}

async function main() {
  const input = [];
  for await (const chunk of process.stdin) input.push(chunk);
  const client = validateDestination(JSON.parse(Buffer.concat(input).toString('utf8')));
  const expected = `v${(await readFile(path.join(root, '.nvmrc'), 'utf8')).trim()}`;
  if (process.version !== expected) throw new Error('Use the Node version from .nvmrc.');
  const clean = isolateEnvironment(process.env, client);
  for (const name of Object.keys(process.env)) delete process.env[name];
  Object.assign(process.env, clean);
  const { build } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react-swc');
  // Intentionally standalone: neither source .env nor vite.config plugins load.
  await build({
    root, configFile: false, envDir: false, mode: 'independent',
    plugins: [react()],
    resolve: { alias: { '@': path.join(root, 'src') }, dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@tanstack/react-query', '@tanstack/query-core'] },
    build: { outDir: 'dist/independent', emptyOutDir: true, sourcemap: false },
  });
  const out = path.join(root, 'dist/independent');
  await writeFile(path.join(out, '_redirects'), '/* /index.html 200\n');
  await writeFile(path.join(out, '_headers'), '/*\n  Cache-Control: no-cache\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  await writeFile(path.join(out, 'build-info.json'), JSON.stringify({ revision, dirty, project: client.VITE_SUPABASE_PROJECT_ID, mode: 'independent', builtAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Independent build prepared in dist/independent (${dirty ? 'uncommitted work; not release-pinned' : 'clean commit'}). No upload or hosted change performed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    // Never dump input, environment, or provider credentials in an exception.
    console.error('Independent build failed. Verify explicit destination, legacy anon key, Node version and local dependencies.');
    process.exitCode = 1;
  });
}
