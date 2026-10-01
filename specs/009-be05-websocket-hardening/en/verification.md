# 009 · BE-05 — WebSocket hardening · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | lint + typecheck + vitest + build | `npm run lint`; `npm run typecheck`; `npx vitest run`; `npm run build` | ✅ | `ws/policy.ts`: `ALLOWED_ORIGINS` (same regex as before, now the only copy — `app.ts` imports it), `isAllowedOrigin` (missing/empty → false), `tokenFromCookie` (first/middle/last cookie, raw value with `=` kept, `mytoken` prefix not matched), `HEARTBEAT_MS` 30 s, `sendDecision` (≤1 MB send, ≤8 MB skip, else terminate). `policy.test.ts` 6 tests → **44/44** green; lint 0; typecheck 0; build ok. | 0.75 | 0.5 | — |
