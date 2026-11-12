// Forwards /daily-schedule and /daily-schedule/* to the Daily Schedule Worker (hub #98).
// The request (URL, method, headers including Authorization, body) and the answer pass
// through unchanged. Nothing is read, changed or kept; the Worker checks sign-in itself.
// The release guard accepts only this exact file (scripts/release-policy.mjs).
export function onRequest({ request, env }) {
  if (!env.DAILY_SCHEDULE) return new Response('Daily Schedule is not connected.', { status: 503 });
  return env.DAILY_SCHEDULE.fetch(request);
}
