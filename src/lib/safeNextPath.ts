/**
 * Post-sign-in redirect targets. Only same-origin, in-app paths are followed;
 * anything else (absolute or protocol-relative URLs, backslash tricks, schemes,
 * whitespace/control characters, the sign-in page itself) falls back to home.
 */
const HOME = "/";
const PROBE_ORIGIN = "https://hub.invalid";

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw.length === 0) return HOME;
  // A single leading slash, not followed by another slash or a backslash.
  if (raw[0] !== "/" || raw[1] === "/" || raw[1] === "\\") return HOME;
  // Browsers strip tabs/newlines and treat "\" as "/" in URLs; refuse them outright.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\\s]/.test(raw)) return HOME;
  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return HOME;
  }
  if (url.origin !== PROBE_ORIGIN) return HOME;
  if (url.pathname === "/auth" || url.pathname.startsWith("/auth/")) return HOME;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Sign-in location that returns to the requested path afterwards. */
export function signInPath(pathname: string, search = "", hash = ""): string {
  const next = safeNextPath(`${pathname}${search}${hash}`);
  return next === HOME ? "/auth" : `/auth?next=${encodeURIComponent(next)}`;
}
