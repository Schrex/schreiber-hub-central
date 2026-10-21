const sourceOrigin = 'https://bitogpfplcquovpdjprk.supabase.co';

/** Rewrite only known Storage hosts and this bucket; never send external URLs to Storage. */
export function classifyTalkMedia(value: string, destinationUrl: string):
  | { kind: 'storage'; path: string }
  | { kind: 'external'; url: string }
  | { kind: 'unavailable' } {
  try {
    const url = new URL(value);
    const destination = new URL(destinationUrl);
    if (url.origin !== sourceOrigin && url.origin !== destination.origin) {
      return url.protocol === 'https:' ? { kind: 'external', url: url.href } : { kind: 'unavailable' };
    }
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/talk-media\/(.+)$/);
    if (!match) return { kind: 'unavailable' };
    const path = decodeURIComponent(match[1]);
    if (path.split('/').some(part => !part || part === '.' || part === '..') || path.includes('\\')) return { kind: 'unavailable' };
    return { kind: 'storage', path };
  } catch {
    return { kind: 'unavailable' };
  }
}
