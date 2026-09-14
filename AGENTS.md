# Matchbox

`@tknf/matchbox` is a public, Hono-based CGI-style library written in TypeScript / ESM.

- Write code comments and project documentation in English.
- Use pnpm and the scripts in `package.json`. Vite+ manages checks, tests, and packaging
  through `vite.config.ts`; `pnpm check` runs formatting, linting, and type checks.
  See `CONTRIBUTING.md` for development commands and PR preparation.
- Use arrow functions and avoid `any` types.
- Preserve public API behavior, types, defaults, and subpath exports unless a breaking change is requested.
- Routes, `.htaccess`, and `.htpasswd` are loaded at build time through `import.meta.glob`
  in `src/with-defaults.ts`. Keep filesystem I/O out of request handling.
  File operations in `src/plugin.ts` run at build time.
- Keep parsing and rule logic in `src/htaccess/` separate from Hono integration in `src/middleware/`.

Update affected documentation alongside changes to public APIs or documented behavior.
Use `docs/api.md` for APIs, `docs/htaccess.md` for `.htaccess`, and `docs/security.md` for security.
Update `README.md` and `CHANGELOG.md` when relevant.
