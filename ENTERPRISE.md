# DingClaw Enterprise Layer

This repo is the enterprise working copy derived from OpenClaw upstream.

## Remote Strategy

- `upstream`: official OpenClaw source
- `origin`: DingClaw enterprise repository

## Working Rule

- Keep upstream changes mergeable
- Prefer new enterprise code in `apps/`, `packages/`, and `extensions/`
- Keep OpenClaw core changes minimal and document them under `patches/openclaw-core/`

## Enterprise Modules

- `apps/admin-console`: Chinese admin console
- `apps/control-api`: control plane API
- `apps/runtime-api`: runtime bridge API
- `apps/jobs`: async jobs and sync tasks
- `packages/*`: enterprise services and shared libraries
- `extensions/dingtalk-enterprise`: DingTalk enterprise connector
- `extensions/oa-tools`: OA-related tools
- `extensions/internal-api-tools`: internal API tools

## Blueprint

Product and architecture blueprints now live inside this repo:

- `docs/blueprint/`

Keep this file aligned with the blueprint before implementing major changes.
