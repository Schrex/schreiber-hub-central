# AI migration preparation — 2026-10-19

Implemented a small provider-neutral request boundary in
`supabase/functions/_shared/ai-json-chat.ts`, used by the representative
`suggest-safety-topic` function. The helper takes an endpoint, key, model, messages
and injectable fetch transport; it reads no environment and makes no provider choice.

The handler retains its existing Lovable gateway endpoint, `LOVABLE_API_KEY`,
`google/gemini-2.5-flash` model, prompts, JSON-object response request, Supabase Auth
check, database queries and successful response shape (`match_talk_id`,
`suggested_topic`, `reasoning`, `roles`, `taskNotes`). HTTP 429 still returns
“Rate limit, try again”; 402 still returns “AI credits exhausted”. Other provider
HTTP failures retain the existing 500 path with `AI error <status>`.

Malformed envelopes, non-JSON/non-object completions, and non-string suggestion
fields now fail with a sanitized `Invalid AI response` rather than silently returning
empty fields or passing objects through. Missing/null optional fields retain the
existing null/empty-string defaults. Transport errors return `AI request failed`.
Provider error bodies and raw model text are not logged or included in these errors;
responses can contain job information and must not become diagnostic output.

## Verification

All tests inject fake fetch implementations with fabricated data; no API keys,
hosted database access or live model requests were used. Focused tests cover:

- Exact POST, JSON content type, Bearer header, model/messages and response format.
- Valid structured content and optional-field defaults/types.
- 402, 429, 401 and 500 status preservation without provider-body disclosure.
- Malformed JSON envelopes, absent choices/content, wrong content types, invalid
  completion JSON, arrays/null/scalars, and sanitized transport exceptions.

Commands:

```sh
bun run test src/test/aiJsonChat.test.ts
bunx --no-install eslint src/test/aiJsonChat.test.ts supabase/functions/_shared/ai-json-chat.ts supabase/functions/suggest-safety-topic/index.ts
bun run verify:edge
git diff --check
```

Focused Vitest: 17/17 passed and included in normal application test discovery.
Focused lint, application TypeScript and all 16 Edge entry-point checks passed.
The sandboxed npx check stalled and was stopped; the approved dependency-access
retry passed. Edge validation is static checking only, without serving handlers.

## Remaining work

No provider was switched, configured, provisioned or called; production and hosted
functions remain untouched. This adapter supports chat-completions-compatible JSON
text responses, not arbitrary vendor APIs, streaming, images, or file inputs.
The other four AI functions retain their current implementations. Caller Auth and
HTTP mapping were preserved by code review/static checks, not exercised as a live
Edge handler. Selection of company provider/model/budget, dedicated credentials,
image and document contracts, timeout/retry policy and synthetic deployed-handler
checks remain separate steps. Migration of data and real account continuity are
not established by these tests.
