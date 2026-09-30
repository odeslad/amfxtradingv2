---
name: amfx-branch-review
description: Read-only review of a branch or commit range of this repo against master and against its AMFX spec (specs/ or archive/), producing a Spanish report — summary of changes, functional comparison with the spec, and relevant improvements strictly inside the diff. Use for "branch review", "revisión de rama", "revisa estos commits" or "revisa la spec NNN".
---

# amfx-branch-review

Read-only. Arguments: `<branch | commit-range | spec NNN>`. Never modify files, never check out, never commit.

## 1. Resolve the range

- A branch: `git fetch origin`, prefer `origin/<branch>`, base `origin/master` (check with `git merge-base` and say which base was used).
- A commit range (`a..b`) or a spec number: this project commits straight to `master`, so a spec's changes are the commits whose body contains `Spec: NNN-…` (`git log --grep='Spec: NNN' --format=%H`); review that set as one diff (`git diff <first>^..<last>` when contiguous, per commit otherwise).
- Collect `git log --oneline`, `git diff --stat`, the full diff (per file if large). Read the touched files fully where the diff alone is not enough.

## 2. Resolve the spec

- Look for `specs/NNN-*/` first, then `archive/*/NNN-*/`. Read `en/requirements.md` (acceptance criteria), `en/design.md` (approach, files, deviations) and `en/tasks.md` + `en/verification.md` (what is checked, verification declared, deviations agreed).
- If none is found, ask with AskUserQuestion whether to continue without a spec or take a pasted description — do not assume.

## 3. Report (Spanish)

```
# Branch review · <rango> 
Base: <base> @ <sha>. <n> commits, <files> archivos, +<add>/−<del>. Capas: <backend, frontend…>

## 1. Resumen de cambios
- Propósito (2-3 frases).
- Por capa/módulo: qué se cambió y por qué (deducido de commits y código).

## 2. Comparación con la spec NNN
- **Cubierto:** criterios de aceptación implementados.
- **Parcial o desviado:** implementado distinto a la spec, con la diferencia (cita el AC/sección). Distingue las desviaciones registradas en verification.md/tasks.md de las no registradas.
- **Pendiente:** criterios sin rastro (distingue los que la spec deja para la validación en producción).
- **Fuera de spec:** cambios sin requisito asociado — justificados o alcance no acordado.
(Sin spec: indica que la sección se omite y por qué.)

## 3. Mejoras propuestas
Solo relevantes y **dentro de las líneas del diff**: refactors claros, simplificaciones evidentes, errores de tipado, riesgos reales (contrato EA ↔ backend, WS, migraciones, race conditions multi-broker). Cada una con `ruta/archivo.ts:línea`, qué y por qué, snippet antes/después si aclara. Ordena por importancia y di cuál puede ser un bug frente a limpieza. Si no hay nada relevante, dilo.
```

Rules:
- Improvements sit on lines the diff adds or changes; side effects on untouched code go at most in one closing line as "fuera del diff".
- No style nitpicks ESLint/Prettier already cover, no speculation, no matters of taste.
- Respect the project's conventions (strict TS, functional components, CSS Modules with design-system variables, no new dependencies).
- Cite facts from git/spec only. When asked "¿cuáles son importantes?", rank: possible bug > clear simplification > readability.
