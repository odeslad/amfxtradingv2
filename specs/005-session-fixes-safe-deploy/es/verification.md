# 005 — Arreglos de sesión y deploy seguro · Verificación

| Tarea | Mecanismo | Comandos | Resultado | Evidencia | Est | Real | Nota |
|---|---|---|---|---|---|---|---|
| 1 | build + curl (usuario) | `npm run build`; backend local con `COOKIE_DOMAIN=.example.test`; `Set-Cookie` de `POST /auth/login` vs `POST /auth/logout` | ✅ | Login: `token=<jwt>; Max-Age=604800; Domain=.example.test; Path=/; …; HttpOnly; Secure; SameSite=None`. Logout: `token=; Domain=.example.test; Path=/; Expires=1970…; HttpOnly; Secure; SameSite=None` — mismo dominio/path/flags, así que el navegador borra la cookie (antes: solo `token=; Path=/`). La ida y vuelta con jar de cookies no sirvió: la cookie es `Secure` y curl nunca la envía por `http://`. Comprobación en producción (logout + recarga → página de login) en la tarea 8. | 0,5 | 0,5 | Visto de paso: un cuerpo JSON malformado responde 500 (`entity.parse.failed` de body-parser); se mapea a 400 en la tarea 3 como desviación acordada. |
