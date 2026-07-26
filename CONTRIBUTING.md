# Contributing to Matchbox

Thanks for your interest in contributing! This project uses **pnpm** as its
package manager — please don't use `npm` or `yarn`.

## Setup

```bash
git clone https://github.com/tknf/matchbox.git
cd matchbox
pnpm install
```

## Development Workflow

```bash
# Run the test suite
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type-check the source
pnpm typecheck

# Lint
pnpm lint:check
pnpm lint:fix

# Format
pnpm format:check
pnpm format:write

# Build the package
pnpm build
```

Before opening a pull request, make sure `pnpm test`, `pnpm typecheck`,
`pnpm lint:check`, and `pnpm format:check` all pass.

## Code Style

- Arrow functions only (no top-level `function` declarations)
- No `any` types
- Keep `src/htaccess/*` (pure parser/logic) and `src/middleware/*` (Hono
  integration) separated
- Every `src/*.ts` file has a colocated `*.test.ts` — add or update tests for
  any behavior you change

## Documentation

If your change adds, changes, or removes a public API or documented behavior,
update the relevant docs in the same pull request: `README.md`, the affected
guide under `docs/` (`api.md`, `htaccess.md`, `security.md`, `roadmap.md`),
and `CHANGELOG.md` where appropriate.

## Reporting Security Issues

Please do not open public issues for security vulnerabilities. See the
[Security Guide](./docs/security.md#security-reporting) for details.

## Pull Requests

1. Fork the repository and create a feature branch
2. Make your changes with clear, focused commits
3. Ensure the checks above pass
4. Open a pull request describing the change and its motivation
