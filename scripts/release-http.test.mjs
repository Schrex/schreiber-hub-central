import { describe, it, expect, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { buildReader, publicOrigin } from './release-http.mjs';

const origin = 'https://82bbfce8.schreiber-hub-preview.pages.dev';
const credentials = { CLOUDFLARE_ACCESS_CLIENT_ID: 'synthetic-id', CLOUDFLARE_ACCESS_CLIENT_SECRET: 'synthetic-secret' };
const response = () => new Response('{"revision":"synthetic"}', { headers: { 'content-type': 'application/json' } });

describe('Access-authenticated build identity adapter', () => {
  it('attaches both Access headers only to validated immutable hosts', async () => {
    const fetcher = vi.fn(async () => response());
    const read = buildReader(credentials, fetcher);
    expect(await read(origin)).toEqual({ revision: 'synthetic' });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', headers: {
      'CF-Access-Client-Id': 'synthetic-id', 'CF-Access-Client-Secret': 'synthetic-secret',
    } });
    await read(publicOrigin);
    expect(fetcher.mock.calls[1][1].headers).toEqual({});
  });
  it.each([
    'https://evil.test', 'https://x.schreiber-hub-preview.pages.dev.evil.test',
    'https://user:password@82bbfce8.schreiber-hub-preview.pages.dev',
    'http://82bbfce8.schreiber-hub-preview.pages.dev', `${origin}:8443`, `${origin}/other`,
  ])('refuses untrusted origin %s before transmitting credentials', async url => {
    const fetcher = vi.fn();
    await expect(buildReader(credentials, fetcher)(url)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([{}, { CLOUDFLARE_ACCESS_CLIENT_ID: 'synthetic-id' }])('fails closed when Access credentials are incomplete', async env => {
    const fetcher = vi.fn();
    await expect(buildReader(env, fetcher)(origin)).rejects.toThrow('credentials required');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403, 302])('rejects Access failure HTTP %s', async status => {
    await expect(buildReader(credentials, async () => new Response('denied', { status }))(origin)).rejects.toThrow('unavailable');
  });
  it('rejects a login page even with HTTP 200', async () => {
    await expect(buildReader(credentials, async () => new Response('<html>Login</html>', {
      headers: { 'content-type': 'text/html' },
    }))(origin)).rejects.toThrow('unavailable');
  });
  it('does not leak credentials through transport error messages', async () => {
    const read = buildReader(credentials, async () => { throw new Error('synthetic-secret'); });
    await expect(read(origin)).rejects.toThrow('Build identity unavailable');
    await expect(read(origin)).rejects.not.toThrow('synthetic-secret');
  });
  it('real HTTP adapter refuses redirects without reaching their destination', async () => {
    const paths = [];
    const server = createServer((req, res) => {
      paths.push(req.url);
      res.writeHead(302, { Location: '/credential-sink' }); res.end();
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    try {
      const read = buildReader(credentials, (_url, options) => fetch(`http://127.0.0.1:${server.address().port}/identity`, options));
      await expect(read(origin)).rejects.toThrow('unavailable');
      expect(paths).toEqual(['/identity']);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  });
});
