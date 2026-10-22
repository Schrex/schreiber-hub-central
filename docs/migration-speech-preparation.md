# Speech migration preparation — 2026-10-19

> Historical migration record. For current production identity and operating rules,
> use [production baseline](production-baseline.md). Do not rerun migration steps
> or treat earlier pending-state descriptions as current status.

Extracted the existing speech HTTP requests into
`supabase/functions/_shared/speech-transport.ts` and connected both
`speak-toolbox-talk` and `transcribe-toolbox-talk` to it. The helper accepts explicit
keys and an injectable fetch function; it does not read credentials or select new
providers. Tests live in `src/test/speechTransport.test.ts` and run in the ordinary
application suite.

## Preserved behavior

- TTS tries Deepgram first, then ElevenLabs after primary HTTP/network/body-read
  failure or when the primary key is unavailable. Missing keys or both providers
  failing retain the browser fallback response.
- Deepgram endpoint, Token authentication, URL-encoded voice and MP3 encoding remain
  unchanged. ElevenLabs endpoint, model `eleven_turbo_v2_5`, MP3 format and voice
  settings remain unchanged. App-settings voice resolution/defaults stay in the
  handler; audio bytes pass through unchanged with the existing handler headers.
- STT uploads the original Blob as `recording.webm`, model `scribe_v2`, audio events
  off and diarization off. Success still updates the session transcript. Missing
  keys retain the existing placeholder/no-api-key response in the handler.
- Provider HTTP errors retain the generic transcription fallback and the existing
  401 `detected_unusual_activity` free-tier message. That inherited message is not
  authorization to upgrade any account.
- Auth, session ownership/admin check, storage download, database updates, CORS and
  HTTP response conventions remain in the handlers without a provider switch.

Intentional error-handling changes: provider response bodies, transport exceptions
and model text are no longer logged by these transport paths. Network and malformed
STT responses use sanitized messages; non-string transcript values are rejected
instead of being written into the database. Missing/null text retains the empty
string default. The surrounding non-provider handler error behavior is unchanged.

## Focused verification

21 fake-fetch tests pass, covering primary audio bytes/request contract, secondary
request settings, primary HTTP/network/body-read fallback, unavailable keys, both
providers failing, STT multipart fields/original bytes, successful/default text,
401/429/500 responses, free-tier classification, malformed payloads and sanitized
network errors. No real audio, employee data, API credentials or network calls were
used. Focused lint passes. Parent workstream runs combined application/lint/Edge
checks after integration.

```sh
bun run test src/test/speechTransport.test.ts
bunx --no-install eslint src/test/speechTransport.test.ts supabase/functions/_shared/speech-transport.ts supabase/functions/speak-toolbox-talk/index.ts supabase/functions/transcribe-toolbox-talk/index.ts
bun run typecheck
git diff --check
```

An initial test attempt used Node environment and hit the suite's browser-only setup;
using the established browser environment fixed the fixture setup. The initial
TypeScript check identified unknown-to-string narrowing, which was corrected before
final checks. These were local test/type errors, not provider requests.

## Remaining gates

Independent provider accounts/keys and usage policy remain unverified. No function
was deployed, and no audio quality, account quota, provider availability or actual
hosted authorization flow has been tested. Tests exercise the transport boundary,
not a served Edge Function or database persistence. Timeouts/retries and audio-format
validation remain unchanged. The existing STT download uses a caller-supplied path
under an admin storage client after session authorization; this extraction does not
establish a path-to-session ownership invariant or change it. Review that separately
before treating hosted file authorization as fully validated. Real-data restore and
production cutover remain separate gates.
