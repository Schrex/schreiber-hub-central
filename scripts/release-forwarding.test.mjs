// Daily Schedule forwarding (#98): the guard accepts exactly the approved function and routing
// file, and refuses everything else.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { backend, digest, fileManifest, forwarding, forwardingId, functionsManifest, validateDeployment, validateFunctions, validateIdentity, verifyPayload } from './release-policy.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const functionFile = 'daily-schedule/[[path]].js';
const revision = 'a'.repeat(40);
const identity = extra => ({ revision, dirty: false, project: backend, mode: 'independent', deployable: true, ...extra });

describe('committed forwarding files', () => {
  it('match the approved hashes in the release policy', () => {
    expect(digest(readFileSync(path.join(repo, 'public/_routes.json')))).toBe(forwarding.routes);
    expect(functionsManifest(path.join(repo, 'functions'))).toEqual(forwarding.functions);
  });
  it('route only /daily-schedule and /daily-schedule/* to Functions', () => {
    expect(JSON.parse(readFileSync(path.join(repo, 'public/_routes.json'), 'utf8')))
      .toEqual({ version: 1, include: ['/daily-schedule', '/daily-schedule/*'], exclude: [] });
  });
});

describe('forwarding function', () => {
  it('passes the request object itself to the binding and returns its answer unchanged', async () => {
    const { onRequest } = await import(pathToModule(functionFile));
    const request = new Request('https://app.schreiberexcavating.com/daily-schedule/api/save?x=1', {
      method: 'POST', headers: { Authorization: 'Bearer token', 'Content-Type': 'text/plain' }, body: 'payload' });
    const answer = new Response('from worker', { status: 207, headers: { 'Set-Cookie': 'a=b' } });
    const fetch = vi.fn(async () => answer);
    expect(await onRequest({ request, env: { DAILY_SCHEDULE: { fetch } } })).toBe(answer);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(request);
    expect(request.bodyUsed).toBe(false);
  });
  it('answers 503 instead of crashing when the binding is not set', async () => {
    const { onRequest } = await import(pathToModule(functionFile));
    expect((await onRequest({ request: new Request('https://app.test/daily-schedule/'), env: {} })).status).toBe(503);
  });
});

describe('release guard with the forwarding function', () => {
  let root, frontend, functions;
  const write = (info = identity({ functions: forwardingId }), withFunctions = true) => {
    writeFileSync(path.join(frontend, 'build-info.json'), JSON.stringify(info));
    const manifest = { schema: 1, deployable: true, revision, project: backend, dirty: false, files: fileManifest(frontend) };
    if (withFunctions) manifest.functions = functionsManifest(functions);
    const raw = JSON.stringify(manifest);
    writeFileSync(path.join(root, 'release.json'), raw);
    return digest(raw);
  };
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'release-forwarding-'));
    frontend = path.join(root, 'frontend'); functions = path.join(root, 'functions');
    mkdirSync(frontend);
    for (const name of ['index.html', '_headers', '_redirects']) writeFileSync(path.join(frontend, name), 'synthetic');
    cpSync(path.join(repo, 'public/_routes.json'), path.join(frontend, '_routes.json'));
    cpSync(path.join(repo, 'functions'), functions, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('accepts exactly the approved function, routing file and identity', () => {
    expect(verifyPayload(root, write(), revision).functions).toEqual(forwarding.functions);
  });
  it('still accepts a fully static build with neither', () => {
    rmSync(functions, { recursive: true }); rmSync(path.join(frontend, '_routes.json'));
    expect(() => verifyPayload(root, write(identity(), false), revision)).not.toThrow();
  });
  it('refuses any other function', () => {
    writeFileSync(path.join(functions, 'other.js'), 'export const onRequest = () => new Response("x");');
    expect(() => functionsManifest(functions)).toThrow('approved forwarding');
  });
  it('refuses another function inside the approved folder', () => {
    writeFileSync(path.join(functions, 'daily-schedule/_middleware.js'), 'export const onRequest = c => c.next();');
    expect(() => functionsManifest(functions)).toThrow('approved forwarding');
  });
  it('refuses a changed function', () => {
    writeFileSync(path.join(functions, functionFile), 'export const onRequest = ({ request }) => fetch(request);');
    expect(() => functionsManifest(functions)).toThrow('differs');
  });
  it('refuses a function changed after the manifest was approved', () => {
    const hash = write();
    writeFileSync(path.join(functions, functionFile), '// changed');
    expect(() => verifyPayload(root, hash, revision)).toThrow();
  });
  it('refuses a linked function', () => {
    rmSync(path.join(functions, functionFile));
    symlinkSync(path.join(repo, 'functions', functionFile), path.join(functions, functionFile));
    expect(() => functionsManifest(functions)).toThrow('links');
  });
  it('refuses a functions folder without the approved function', () => {
    rmSync(path.join(functions, functionFile));
    expect(() => functionsManifest(functions)).toThrow('incomplete');
  });
  it.each(['_worker.js', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc', 'functions'])('refuses a %s in the static files', name => {
    writeFileSync(path.join(frontend, name), 'synthetic');
    expect(() => write()).toThrow('static');
  });
  it.each(['_worker.js', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc'])('refuses a %s beside the function', name => {
    writeFileSync(path.join(functions, name), 'synthetic');
    expect(() => functionsManifest(functions)).toThrow('approved forwarding');
  });
  it.each(['wrangler.toml', 'wrangler.jsonc', '_worker.js'])('refuses an artifact with a %s beside frontend', name => {
    const hash = write(); writeFileSync(path.join(root, name), 'synthetic');
    expect(() => verifyPayload(root, hash, revision)).toThrow('layout');
  });
  it.each([
    ['sends more paths to Functions', { version: 1, include: ['/*'], exclude: [] }],
    ['adds a path', { version: 1, include: ['/daily-schedule', '/daily-schedule/*', '/api/*'], exclude: [] }],
    ['is reformatted', { version: 1, include: ['/daily-schedule', '/daily-schedule/*'], exclude: [] }],
  ])('refuses a routing file that %s', (_, routes) => {
    writeFileSync(path.join(frontend, '_routes.json'), JSON.stringify(routes));
    expect(() => write()).toThrow('_routes.json');
  });
  it('refuses a routing file outside the root', () => {
    mkdirSync(path.join(frontend, 'assets'));
    cpSync(path.join(repo, 'public/_routes.json'), path.join(frontend, 'assets/_routes.json'));
    expect(() => write()).toThrow('static');
  });
  it('refuses the function without its routing file', () => {
    rmSync(path.join(frontend, '_routes.json'));
    expect(() => verifyPayload(root, write(), revision)).toThrow('approved set');
  });
  it('refuses the routing file without the function', () => {
    rmSync(functions, { recursive: true });
    expect(() => verifyPayload(root, write(identity({ functions: forwardingId }), false), revision)).toThrow();
  });
  it('refuses a function the manifest does not list', () => {
    expect(() => verifyPayload(root, write(identity({ functions: forwardingId }), false), revision)).toThrow('approved set');
  });
  it('refuses a build identity without the forwarding marker', () => {
    expect(() => verifyPayload(root, write(identity()), revision)).toThrow('approved set');
  });
  it('refuses a build identity naming other Functions', () => {
    expect(() => verifyPayload(root, write(identity({ functions: 'f'.repeat(64) })), revision)).toThrow('identity');
  });
});

describe('deployments that use Functions', () => {
  const deployment = { id: '22222222-2222-2222-2222-222222222222', environment: 'production', latest_stage: { name: 'deploy', status: 'success' }, url: 'https://abcdef12.schreiber-hub-preview.pages.dev', uses_functions: true };
  it('are accepted only with the approved forwarding identity', () => {
    expect(validateDeployment(deployment, deployment.id)).toContain('pages.dev');
    expect(() => validateFunctions(deployment, identity({ functions: forwardingId }))).not.toThrow();
    for (const info of [identity(), identity({ functions: 'f'.repeat(64) }), undefined]) expect(() => validateFunctions(deployment, info)).toThrow('unapproved');
  });
  it('static deployments need no marker', () => {
    expect(() => validateFunctions({ ...deployment, uses_functions: false }, identity())).not.toThrow();
  });
  it('identity with an unknown Functions marker is not approved', () => {
    expect(() => validateIdentity(identity({ functions: 'f'.repeat(64) }), revision)).toThrow('identity');
    expect(() => validateIdentity(identity({ functions: forwardingId }), revision, true)).not.toThrow();
  });
});

function pathToModule(file) {
  return new URL(`../functions/${file.replace(/\[/g, '%5B').replace(/\]/g, '%5D')}`, import.meta.url).href;
}
