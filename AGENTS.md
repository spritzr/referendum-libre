# AGENTS.md

Guidance for AI coding agents working in this repository.

## Package manager

Use **pnpm** for installs and package scripts. The project pins pnpm in `package.json` via `packageManager`, and `pnpm-lock.yaml` is the canonical lockfile.

- Install dependencies with `pnpm install`.
- Run scripts as `pnpm <script>` (for example, `pnpm lint`, `pnpm test`, `pnpm format`).
- Run the local Expo CLI as `pnpm expo ...` (for example, `pnpm expo prebuild`).
- pnpm settings live in `pnpm-workspace.yaml` (notably `enableGlobalVirtualStore: true` for faster repeated `node_modules` linking across git worktrees). Do not add a project `.npmrc`.
- Do not create or update `package-lock.json` or `yarn.lock`.
- If dependencies change, update and commit `pnpm-lock.yaml`.

pnpm is preferred for fast local and worktree setup because it reuses a global content-addressable store across checkouts.

## Contributor docs

Human-facing setup and workflow details live in `docs/CONTRIBUTING.md`; keep this file aligned with it when changing build, install, or validation commands.
