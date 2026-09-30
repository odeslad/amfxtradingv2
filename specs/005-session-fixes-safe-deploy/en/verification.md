# 005 — Session fixes and safe deploy · Verification

| Task | Mechanism | Commands | Outcome | Evidence | Est | Actual | Note |
|---|---|---|---|---|---|---|---|
| 1 | build + curl (user) | `npm run build`; local backend with `COOKIE_DOMAIN=.example.test`; `Set-Cookie` of `POST /auth/login` vs `POST /auth/logout` | ✅ | Login: `token=<jwt>; Max-Age=604800; Domain=.example.test; Path=/; …; HttpOnly; Secure; SameSite=None`. Logout: `token=; Domain=.example.test; Path=/; Expires=1970…; HttpOnly; Secure; SameSite=None` — same domain/path/flags, so the browser deletes the cookie (before: `token=; Path=/` only). The cookie-jar round trip could not be used: the cookie is `Secure` and curl never sends it over `http://`. Production check (logout + reload → login page) in task 8. | 0.5 | 0.5 | Spotted meanwhile: a malformed JSON body answers 500 (body-parser `entity.parse.failed`); mapped to 400 in task 3 as an agreed deviation. |
