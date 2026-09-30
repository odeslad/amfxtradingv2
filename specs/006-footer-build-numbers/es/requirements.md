# 006 — Números de build en el footer

> Estado: **aprobada**

## Contexto

El footer de la app muestra `AMFX Trading Terminal v2.0 · © 2026` y nada identifica qué build de cada capa está en marcha. Los deploys son por capa (frontend, backend, EA) desde `master`, así que el usuario quiere un sello de build `frontend.backend.ea` donde cada número aumente solo cuando cambia su propia capa. El número de commits en `master` que tocan el directorio de cada capa (`git rev-list --count HEAD -- <dir>`) tiene exactamente esa propiedad, no requiere incremento manual y está disponible en el VPS porque ambos builds se ejecutan desde el checkout git. Hoy los contadores son `157.155.28`.

## Capas afectadas

- backend
- frontend

## Historias de usuario

- Como usuario, quiero ver `build: F.B.E` en el footer, para saber de un vistazo qué revisiones de frontend, backend y EA están desplegadas.
- Como usuario, quiero que un número cambie solo cuando cambia su capa, para que un deploy solo de frontend se vea como tal.

## Criterios de aceptación

- AC 1. CUANDO se compila el frontend ENTONCES su número de build es el recuento de commits que tocan `frontend/` en el momento del build, incrustado como constante en tiempo de compilación (sin llamada a git en el navegador).
- AC 2. CUANDO se llama a `GET /version` ENTONCES el backend responde `200 { "backend": <n>, "ea": <n> }` donde cada número es el recuento de commits que tocan `backend/` y `ea/` en el checkout desde el que corre el proceso, calculado una vez al arrancar; la ruta no necesita autenticación (como `/health`).
- AC 3. CUANDO git no está disponible o el comando falla ENTONCES el número afectado es `0` y el arranque/build continúa con un aviso en el log.
- AC 4. CUANDO se renderiza el footer ENTONCES muestra `AMFX Trading Terminal v2.0 · © <año> · build: F.B.E` usando la constante del frontend y la respuesta de `/version`; mientras `/version` no ha respondido (o falla) las partes de backend y EA muestran `?` (`build: 157.?.?`).
- AC 5. CUANDO un commit toca solo `frontend/` ENTONCES tras desplegar solo cambia el primer número; lo mismo para `backend/` y `ea/`.
- AC 6. CUANDO el footer se renderiza en móvil (≤ 768 px) ENTONCES sigue oculto como hoy.

## Fuera de alcance

- Informar del build del EA realmente cargado en MT4 (requeriría que el EA enviara su versión por `account.json`); el número del EA refleja el checkout del VPS.
- Mostrar el SHA de git o una marca de tiempo del deploy.
- Cualquier cambio en la capa EA.
