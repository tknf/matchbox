# Contributing to Matchbox

Thanks for your interest in contributing! This project uses **pnpm** as its
package manager — please don't use `npm` or `yarn`.

## Setup

Use the Node.js version in `.node-version` and the pnpm version declared in
`package.json`. Vite+ is installed locally and runs through the package scripts.
The library and all four examples share `pnpm-workspace.yaml` and the root lockfile.

```bash
git clone https://github.com/tknf/matchbox.git
cd matchbox
pnpm install
pnpm build
```

## Development Workflow

```bash
# Check formatting, lint rules, and TypeScript types together
pnpm check

# Apply formatting and safe lint fixes
pnpm check:fix

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

Before opening a pull request, run `pnpm build`, `pnpm check`, and
`pnpm test:coverage` in that order. The examples use the built library for type
checks. The individual check scripts remain available when needed.
`pnpm build` uses `vp pack` to emit ESM files and declarations in `dist/`.

## Zed and Commit Hooks

Open the repository root in Zed with the Oxc extension installed. The committed
`.zed/settings.json` uses the formatter configuration in `vite.config.ts` and
enables formatting and safe lint fixes on save for JavaScript and TypeScript.

`pnpm install` runs `prepare` to install the Vite+ hook dispatcher. The committed
`.vite-hooks/pre-commit` runs `pnpm staged`, which checks and fixes staged files
using the same configuration. Generated dispatcher files in `.vite-hooks/_/`
are ignored. Run `pnpm prepare` to reinstall the dispatcher after cloning.

To run an example, build the library at the repository root, then run
`pnpm --dir examples/basic dev` (or choose another example directory).

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

## Dependency Updates

Dependabot checks for version updates on the first day of each month at 09:00
Asia/Tokyo, as configured in [`.github/dependabot.yml`](./.github/dependabot.yml).
The root package and all four examples share one npm configuration (Dependabot's
ecosystem name for pnpm). Only patch and major version updates are allowed;
routine minor updates do not open pull requests. Patch updates are grouped per ecosystem.
Vite major updates are grouped across these directories; other major updates
remain individual pull requests for separate review.

Review minor releases when a needed feature or bug fix requires them, or during
periodic maintenance. Skipping them also skips fixes that are only released on a
newer minor line, including patch releases on that line.

At most three npm and two GitHub Actions version-update pull requests can be open
at once. These limits are not monthly quotas. Dependabot security updates, when
enabled in the repository settings, are independent of the monthly schedule and
these limits. The `allow.update-types` filter and the groups above apply only to
version updates, so security fixes can still require a minor upgrade.

## Reporting Security Issues

Please do not open public issues for security vulnerabilities. See the
[Security Guide](./docs/security.md#security-reporting) for details.

## Pull Requests

1. Fork the repository and create a feature branch
2. Make your changes with clear, focused commits
3. Ensure the checks above pass
4. Open a pull request describing the change and its motivation
