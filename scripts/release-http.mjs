import { requireValue } from './release-policy.mjs';

export const publicOrigin = 'https://app.schreiberexcavating.com';

// Access credentials belong only to this project's immutable deployment hosts.
// Never attach them to the custom domain, Cloudflare API, or a redirect target.
export function buildReader(env, fetcher = fetch) {
  return async origin => {
    const url = new URL(origin);
    requireValue(url.origin === origin && url.protocol === 'https:' && !url.username && !url.password && !url.port,
      'Unexpected build identity origin.');
    const immutable = /^[a-z0-9-]+\.schreiber-hub-preview\.pages\.dev$/.test(url.hostname);
    requireValue(immutable || origin === publicOrigin, 'Unexpected build identity host.');
    const headers = {};
    if (immutable) {
      requireValue(env.CLOUDFLARE_ACCESS_CLIENT_ID && env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
        'Cloudflare Access service credentials required for immutable build verification.');
      headers['CF-Access-Client-Id'] = env.CLOUDFLARE_ACCESS_CLIENT_ID;
      headers['CF-Access-Client-Secret'] = env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
    }
    try {
      const response = await fetcher(`${origin}/build-info.json`, {
        headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      });
      requireValue(response.ok && response.headers.get('content-type')?.includes('application/json'),
        'Build identity response is not successful JSON.');
      return await response.json();
    } catch {
      throw new Error('Build identity unavailable; check Access service policy, credentials and deployment URL.');
    }
  };
}
