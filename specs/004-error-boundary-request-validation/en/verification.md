# 004 — Error boundary and request validation · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | build + local script | `npm run build`; scratch `verify-task1.js` (Express + compiled `asyncRoute`/`errorHandler`, routes `/boom` throwing, `/bad` throwing `BadRequest`, `/stray` rejecting an unawaited promise, `/ok`) | ✅ | `tsc` clean. `/boom` → `500 {"error":"Internal error"}` with `[HTTP] GET /boom` + stack in stderr; `/bad` → `400 {"error":…,"message":…}`; `/stray` logged `[UNHANDLED] rejection`; `/ok` → 200 afterwards, process alive. Script not committed. | 1 | 1 | Verified against the compiled `dist/` instead of a temporary route in `app.ts` (no DB needed). |
