# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains all runtime source code:
  - `index.ts`: custom CLI entrypoint (arg parsing, auth/model/tool init, agent loop, TUI orchestration).
  - `index_code.ts`: passthrough entrypoint delegating full runtime behavior to `@mariozechner/pi-coding-agent`.
  - `auth.ts`: OpenAI Codex OAuth login, credential persistence, token refresh, API key resolution.
  - `tools.ts`: built-in coding tools (`read/bash/edit/write/grep/find/ls`) + `webfetch` tool.
  - `mcp.ts`: MCP stdio client, `tools/list` discovery, dynamic MCP tool registration, client cleanup.
  - `prompt.ts`: system prompt construction + Skills loading (`~/.nano-clawd/skills` + defaults).
  - `tui.ts`: terminal UI rendering, editor/input flow, agent event visualization.
  - `proxy.ts`: system proxy detection (macOS `scutil --proxy`) and global undici proxy setup.
- `dist/` is generated TypeScript output (`tsc`).
- Root config/docs: `package.json`, `tsconfig.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`.

## Build, Run, and Development Commands
- `npm install`: install dependencies.
- `npm run build`: compile TypeScript to `dist/`.
- `npm run start`: run custom CLI entrypoint (`node dist/index.js`).
- `npm run dev`: run custom CLI directly from source via Bun (`bun run src/index.ts`).
- `npx tsc --noEmit`: strict type-check without emitting files.
- Optional runtime entrypoint:
  - `node dist/index_code.js`
  - `bun run src/index_code.ts`

## Coding Style & Naming Conventions
- Language: TypeScript (ESM, `moduleResolution: NodeNext`).
- Local imports should use `.js` suffix in TS source.
- Follow existing style:
  - 2-space indentation
  - no semicolons
  - concise comments only where needed
- Naming:
  - `camelCase` for variables/functions
  - `PascalCase` for types/interfaces/classes
  - lowercase filenames (e.g. `mcp.ts`, `prompt.ts`)
- Keep `index.ts` focused on orchestration; place feature logic in dedicated modules.

## Testing & Verification
- No formal test framework is configured currently.
- Minimum checks before merging:
  - `npx tsc --noEmit`
  - `npm run build`
  - smoke-test affected flow (`npm run start` or `npm run dev`)
- For behavior/UI changes, include manual verification steps (and screenshots/GIFs for TUI-visible changes when useful).

## Commit & Pull Request Guidelines
- Prefer Conventional Commits, e.g.:
  - `feat(mcp): add retry when server initialize fails`
  - `fix(tui): stop loader on turn_end`
- PR description should include:
  - what changed and why
  - impacted files/modules
  - verification steps and outcomes
  - any follow-up work or known limitations

## Security & Configuration Tips
- Never commit secrets from `~/.nano-clawd/` (e.g. `auth.json`, MCP env secrets, private skill data).
- Treat MCP server configs as trusted-code boundaries; review command/args/env before enabling.
- Validate proxy-related changes carefully (`proxy.ts`) to avoid breaking outbound network calls.
- Keep generated artifacts (`dist/`) in sync with source changes when preparing releases.
