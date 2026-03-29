# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Repository at a glance

OpenClaw is a multi-channel AI gateway. This repo also carries the DingClaw enterprise layer, which adds DingTalk-centered enterprise workflows, internal APIs, policy/identity services, audit trails, and admin consoles around the OpenClaw core.

The repository already includes a blueprint set under `../blueprint/` that defines the enterprise direction, architecture, service split, package boundaries, and MVP build slices.

The big-picture runtime shape is:

- **Gateway**: one long-lived WebSocket daemon owns messaging surfaces and serves the canvas host on the same port. Clients connect over WS for control-plane actions; nodes also connect over WS with `role: node`.
- **Clients**: CLI, admin UI, desktop shell, and mac app all talk to the Gateway.
- **Nodes**: macOS/iOS/Android/headless nodes expose device-side commands such as canvas, camera, screen, and location.
- **Plugins**: built-in and extension plugins live under `extensions/*` and integrate through the public plugin SDK surface.
- **Enterprise layer**: DingClaw’s `apps/`, `packages/`, and enterprise extensions add control-plane services, identity/policy/approval/audit modules, and Chinese admin UX.

## Key repo layout

- `src/` — core OpenClaw source, including CLI wiring, gateway, routing, infra, security, plugin SDK, and UI helpers.
- `apps/` — app surfaces such as `admin-console`, `desktop-shell`, `control-api`, `runtime-api`, and `jobs`.
- `packages/` — shared enterprise services and models such as `shared-types`, `shared-config`, `database`, `identity-service`, `policy-engine`, `approval-service`, `audit-service`, `runtime-bridge`, and `model-registry`.
- `extensions/` — plugins and provider/channel integrations.
- `ui/` — web UI implementation.
- `docs/` — user-facing docs and architecture notes.
- `.claude/guide/` — the repo knowledge base for Claude Code; keep it aligned with the actual source tree and update it when architecture or core flows change.
- `scripts/` — build, codegen, packaging, and validation scripts.

## Common commands

### Setup

- Install dependencies: `pnpm install`
- Run the CLI locally: `pnpm dev`
- Run the packaged CLI entry: `pnpm openclaw <command>`
- Run the desktop shell: `pnpm desktop:dev`
- Run the admin console: `pnpm admin:console`
- Run the web UI: `pnpm ui:dev`

### Build and checks

- Full build: `pnpm build`
- TypeScript check: `pnpm tsgo`
- Lint: `pnpm lint`
- Format check: `pnpm format:check`
- Combined repo check: `pnpm check`
- Docs checks: `pnpm check:docs`
- Config schema baseline: `pnpm config:docs:check` / `pnpm config:docs:gen`
- Plugin SDK API baseline: `pnpm plugin-sdk:api:check` / `pnpm plugin-sdk:api:gen`
- Plugin SDK export sync: `pnpm plugin-sdk:check-exports`

### Tests

- Full test suite: `pnpm test`
- Coverage: `pnpm test:coverage`
- Single test file or filter: `pnpm test -- <path-or-filter> [vitest args...]`
- Unit-only run: `pnpm test:fast`
- Gateway-focused tests: `pnpm test:gateway`
- Channel-specific tests: `pnpm test:channels`
- UI tests: `pnpm test:ui`
- E2E tests: `pnpm test:e2e`
- Live tests: `pnpm test:live`

### Docs and generated artifacts

- Docs link/content checks: `pnpm check:docs`
- Config schema baseline: `pnpm config:docs:check` / `pnpm config:docs:gen`
- Plugin SDK API baseline: `pnpm plugin-sdk:api:check` / `pnpm plugin-sdk:api:gen`
- Plugin SDK export sync: `pnpm plugin-sdk:check-exports`

## Architecture notes that matter

### Gateway and protocol

- The Gateway is the central runtime and the only place that opens the WhatsApp session.
- WebSocket handshake is mandatory; `connect` is the first frame.
- Protocol types are defined with TypeBox schemas and code-generated into JSON Schema and Swift models.
- The canvas host is served from the Gateway HTTP server, so UI/runtime changes often affect both protocol and web assets.

### Channels, routing, and nodes

- Shared messaging logic spans core channels plus extension channels; when changing routing, allowlists, pairing, onboarding, or command gating, consider all supported channels, not just the one you are touching.
- Channel behavior is split between core channel code in `src/{telegram,discord,slack,signal,imessage,web,channels,routing}` and plugin-based channels in `extensions/*`.
- Node-facing features use the same Gateway transport but different capabilities and permissions than normal clients.

### Plugin and extension boundaries

- Extension production code should treat `openclaw/plugin-sdk/*` plus local `api.ts` / `runtime-api.ts` barrels as the public surface.
- Do not import core `src/**`, `src/plugin-sdk-internal/**`, or another extension’s `src/**` directly from extension production code.
- Inside `extensions/<id>/**`, keep imports inside that package root unless you are going through the public plugin SDK contract.
- Bundled plugin metadata must stay aligned across plugin ids, package names, and `openclaw.plugin.json`.

### Enterprise layer

- DingClaw keeps enterprise concerns in `apps/`, `packages/`, and dedicated extensions rather than spreading them through core gateway code.
- `packages/identity-service` derives `SubjectClaims` from ingress data.
- `packages/policy-engine` evaluates routing, tool permissions, approval needs, and persona shape.
- `packages/approval-service` manages approval request lifecycle state.
- `packages/audit-service` records, queries, and exports audit events.
- `packages/runtime-bridge` ties the identity, policy, approval, and audit layers together into one runtime decision.
- `packages/shared-types` carries the shared enterprise ingress, claims, policy, approval, audit, and runtime decision types.
- `apps/admin-console` is the Chinese management console, and `apps/runtime-api` / `apps/control-api` are the main control-plane surfaces.
- `.claude/guide/` already contains the initial repo index, architecture notes, API inventory, custom-library notes, and core flow docs; keep it updated when changing these surfaces.

## Practical working rules

- Use Node 22+ and `pnpm`.
- Prefer the narrowest test that proves the change; if the change touches build output, packaging, lazy-loading/module boundaries, or a published surface, run `pnpm build`.
- For targeted debugging, use `pnpm test -- <path-or-filter> [vitest args...]` instead of raw `vitest run`.
- If dependencies are missing (for example `node_modules` missing, `vitest not found`, or `command not found`), run the repo’s package-manager install command once, then rerun the exact command; report the first actionable error if it still fails.
- Use repo-root relative file references in chat replies, like `src/gateway/server-methods/channels.ts:42`.
- Keep docs links root-relative inside `docs/**/*.md`; use full `https://docs.openclaw.ai/...` URLs in README and user-facing replies when linking docs.
- For macOS gateway debugging, start/stop the gateway via the app or `scripts/restart-mac.sh`, not ad-hoc tmux sessions.
- Do not edit `docs/zh-CN/**` unless explicitly asked.
- Do not change version numbers or release artifacts unless the user explicitly asks.

## If you need more context

- `README.md` describes the DingClaw enterprise direction and repo structure.
- `docs/concepts/architecture.md` explains the Gateway/WebSocket model.
- `docs/cli/index.md` is the CLI command map.
- `docs/channels/index.md` lists supported messaging channels.
- `../blueprint/01-product-overview.md` and `../blueprint/02-system-architecture.md` are the best starting points for the DingClaw enterprise direction.
- `../blueprint/03-identity-and-policy.md`, `../blueprint/08-api-boundaries.md`, and `../blueprint/11-package-boundaries.md` explain the enterprise service split and public boundaries.
- `../blueprint/12-mvp-build-slices.md` is the fastest path to understand the intended build order.
