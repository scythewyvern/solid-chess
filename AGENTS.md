# AGENTS.md — instructions for AI coding agents

This is a Bun + TypeScript + SolidJS chess app: framework-free rules engine
(`src/engine.ts`), SolidJS UI (`src/*.tsx`), WebSocket multiplayer
(`server/` + `src/use-online-game.ts`). Single-service deploy: one Bun server
serves the static client and `/ws`.

## Commands

- `bun lint` — run after every code change; fix all errors and warnings.
- `bun fmt` — run at the end of every task (after lint is clean).
- `bun test` — run after behavior changes; keep 95/95 green.
- `bun run build` — run before finishing deploy/server/client changes.
- `bun lint:fix` — only for safe mechanical fixes; re-check the diff after.

## Conventions

- Strict TypeScript, no `any`. `let` over `const` only where reassignment
  happens; `function` declarations over arrow functions for top-level code.
- Single quotes, no semicolons (enforced by oxfmt, `oxfmt.config.ts`).
- kebab-case file names.
- Engine stays dependency-free (`src/engine.ts` imports nothing);
  `server/rooms.ts` stays socket-free (pure reducer, unit-tested).
- Complexity limit is 20 (`oxlint.config.ts`): split large functions into
  small helpers instead of raising the limit.

## SolidJS 2 — not React

- Components run once (no re-render); reactivity is fine-grained via
  signals. Do not port React patterns.
- Never read `props.*` outside JSX/tracked scopes or event handlers —
  wrap in accessors (`() => props.x`). Native-element handlers must be
  wrapped: `onClick={() => props.onX()}`. Prefer array/object `class`
  props, object `style` props, and `<Show>` over early returns.
- Name signals/memos/effects (`{ name: '...' }`) so diagnostics attribute
  scopes by name.

## SolidJS skills (in node_modules — read on demand)

- `node_modules/solid-js/skills/reactivity-diagnostics/SKILL.md` — repair
  guide mapping every dev-mode diagnostic code (e.g.
  `REACTIVE_WRITE_IN_OWNED_SCOPE`) to its prescribed fix. Read whenever a
  Solid diagnostic code appears in test output or the browser console.
- `node_modules/@solidjs/diagnostics/skills/agent-loops/SKILL.md` — how to
  capture reactive evidence (which scopes re-ran and why, wasted recomputes,
  cost tables) and assert budgets, in tests and against live pages.

## Reactive diagnostics — capture evidence, don't guess

- In tests: `captureArtifact()` from `@solidjs/diagnostics` wraps a scenario;
  matchers from `@solidjs/diagnostics/vitest` (`toHaveNoDiagnostics`,
  `toStayWithinRerunBudget`, `toHaveNoWaste`, …) assert on it. No browser needed.
- Against the running dev server (`diagnostics: true` in `vite.config.ts`;
  dev-only, no-op in builds; needs an open page connected to the dev server):
  - `GET /__solid/diagnostics` — status and connected client count
  - `POST /__solid/diagnostics` `{"method":"begin"}` then `{"method":"end"}`
    — capture a session into an artifact
  - `{"method":"whyDidRun","params":{"name":"<scope name>"}}` — re-runs of one scope
  - `{"method":"costs"}` — running cost tables
