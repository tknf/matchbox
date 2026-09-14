# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-14

### Breaking Changes

- **BREAKING:** `MatchboxPlugin` now requires Vite 8 and configures Hono JSX
  through `oxc.jsx` instead of the deprecated `esbuild` options. Vite 7 and
  earlier are no longer supported. Upgrade to Vite 8 or a Vite 8-based Vite+
  toolchain before updating Matchbox. See the
  [v1.0.0 migration guide](./README.md#migration-to-v100).
- **BREAKING (SEC-010):** `$_SERVER` no longer includes environment
  variables, and `cgiinfo()`'s "$_SERVER" section no longer dumps them.
  Previously all environment variables (`process.env`/`c.env`) were merged
  into `$\_SERVER`, which could leak secrets to any page reading
`$_SERVER.SOME_VAR` or to anyone viewing a page that calls `cgiinfo()`.
  `$\_SERVER` now contains only request metadata (`REQUEST_METHOD`,
`REQUEST_URI`, `REMOTE_ADDR`, `USER_AGENT`, `SCRIPT_NAME`, `PATH_INFO`,
`QUERY_STRING`).
  - Migration: read environment variables from `context.$_ENV` instead of
    `context.$_SERVER` — `$_ENV` is unaffected and still exposes the full
    environment as before.

### Added

- ✨ **`trustProxy` option** (default `false`) — controls whether
  `X-Forwarded-For`/`X-Real-IP` are trusted when resolving the client IP for
  `$_SERVER.REMOTE_ADDR`, the `%{REMOTE_ADDR}` htaccess variable, and
  Allow/Deny IP matching. Previously these headers were always trusted,
  letting a client spoof its IP to bypass IP-based access control; the new
  default ignores them and falls back to a directly-known address (or
  `127.0.0.1`). All three call sites now share one resolver, so they always
  agree on the same client IP. See
  [Security Guide](./docs/security.md#sec-003-x-forwarded-for-trust-is-opt-in).
- ✨ **`sessionSecret` option** — signs the `$_SESSION` cookie with
  HMAC-SHA256 (via Web Crypto, so it works on Node, Bun, and Cloudflare
  Workers) so a client can no longer tamper with session contents
  undetected. Without it, sessions remain unsigned as before (with a one-time
  `logger` warning recommending it be set in production). See
  [Security Guide](./docs/security.md#sec-004-session-cookie-signing-is-opt-in-via-sessionsecret).
- ✨ **`maxBodySize` option** (default 10 MiB) — rejects request bodies over
  this size with `413` before they are parsed, via `hono/body-limit`. Pass
  `0` to disable the limit. Bodyless methods (`GET`/`HEAD`) now skip
  `parseBody` entirely.
- ✨ **`handlerTimeoutMs` option** (opt-in, no default) — responds `504
Gateway Timeout` if a page `component` takes longer than this to resolve.
- ✨ **`debug` option** (default `false`) — the runtime error page shows a
  generic "Internal Server Error" instead of the error message/stack trace
  unless `debug: true` is set; the original error is still passed to
  `logger` regardless. See
  [Security Guide](./docs/security.md#sec-006-error-page-detail-is-opt-in-via-debug).

### Changed

- Development tooling now uses Vite+ for checks, tests, and library packaging.
  The library and examples share a pnpm workspace, with Zed settings and a
  pre-commit hook for staged-file checks. Public exports remain unchanged.
- `saveSessionToCookie`/`getSessionFromCookie` are now `async` (needed for
  HMAC signing via Web Crypto). If you call them directly (outside of
  `createCgi`/`createCgiWithPages`), `await` the calls.
- `hono/basic-auth` middleware and the `.htpasswd` credential map are now
  built once per directory at setup time instead of on every request;
  credential lookup uses a `Map` and a constant-time password comparison.
- Failed `parseBody` calls are now logged via `logger` (at `"warn"` level)
  instead of being silently swallowed; the request still falls back to an
  empty body.

### Fixed

- Client IP resolution for `$_SERVER.REMOTE_ADDR`, htaccess `%{REMOTE_ADDR}`,
  and Allow/Deny IP matching previously used three separate, inconsistent
  implementations (e.g. one didn't split `X-Forwarded-For` on commas). They
  now share a single implementation (`resolveClientIp`).

## [0.3.0] - 2024-12-24

### Breaking Changes

- **BREAKING:** Changed the fourth parameter of `createCgiWithPages` from `RewriteMap` to `HtaccessConfig` type
  - Migration: Use the new `parseHtaccess()` function or continue using `.htaccess` files (automatic migration)
  - See [Migration Guide](./docs/htaccess.md#migration-from-v02x-to-v030) for details
- **BREAKING:** .htaccess parser is now more strict - malformed directives will throw errors instead of being silently ignored
  - Invalid syntax will be reported with clear error messages
  - Use try-catch when parsing user-provided .htaccess content

### Added

- ✨ **RewriteCond** - Full support for conditional URL rewriting
  - Variable expansion: `%{HTTP_HOST}`, `%{REQUEST_URI}`, `%{QUERY_STRING}`, and more
  - Multiple conditions with AND/OR logic
  - Case-insensitive matching with `[NC]` flag
- ✨ **Complete RewriteRule Flags**
  - `[L]` - Last rule, stop processing
  - `[R]` / `[R=301]` / `[R=302]` - Redirect with custom status code
  - `[F]` - Forbidden (403)
  - `[G]` - Gone (410)
  - `[NC]` - No Case (case-insensitive)
  - `[QSA]` - Query String Append
  - `[QSD]` - Query String Discard
  - `[NE]` - No Escape
- ✨ **ErrorDocument** - Custom error handling for HTTP status codes
  - Support for 4xx and 5xx error codes
  - External URL targets (`http://`/`https://`) trigger a redirect
  - Local path targets are parsed but not yet served (see [`.htaccess` guide](./docs/htaccess.md#error-handling))
- ✨ **Header Directive** - HTTP header manipulation
  - `Header set` - Set response headers
  - `Header append` - Append to existing headers
  - `Header unset` - Remove headers
- ✨ **Security Headers** - Built-in security header helpers
  - `securityHeaders.xFrameOptions()` - Clickjacking protection
  - `securityHeaders.xContentTypeOptions()` - MIME sniffing protection
  - `securityHeaders.xssProtection()` - XSS filter
  - `securityHeaders.hsts()` - Strict Transport Security
  - `securityHeaders.csp()` - Content Security Policy
  - `securityHeaders.referrerPolicy()` - Referrer policy
  - `securityHeaders.permissionsPolicy()` - Permissions policy
- ✨ **Advanced .htaccess Parser**
  - Quoted strings with spaces: `"value with spaces"`
  - Escape sequences: `\"`, `\\`
  - Multi-line continuations with `\`
  - Comment support: `#`
  - Backward compatible with simplified flag syntax (both `[R=301]` and `R=301`)
- 📚 **New Documentation**
  - [Apache .htaccess Features Reference](./docs/htaccess.md) - Complete feature list
  - Migration guide for v0.2.x users
  - Usage examples and best practices

### Changed

- Improved .htaccess parsing with better error messages
- RewriteRule flags are now properly structured (typed objects instead of raw strings)
- Redirect middleware now preserves relative URLs in Location header
- Relative redirect targets are automatically resolved against base path

### Fixed

- RewriteCond directives are now correctly associated with their subsequent RewriteRule
- Orphaned RewriteCond directives are properly cleared
- Fixed handling of malformed `Redirect` directives with invalid status codes
- Fixed relative path resolution for nested directory .htaccess files

### Migration from v0.2.x

**If using `.htaccess` files:** No changes required! The new parser is backward compatible.

**If manually constructing configuration:**

```typescript
// Before (v0.2.x)
const rewriteMap = {
  "/": [
    { type: "redirect", code: "301", source: "/old", target: "/new" }
  ]
};

// After (v0.3.0)
import { parseHtaccess } from "@tknf/matchbox";

const htaccessConfig = {
  "/": parseHtaccess(`Redirect 301 /old /new`)
};
```

See the [full migration guide](./docs/htaccess.md#migration-from-v02x-to-v030) for more details.

## [0.2.6] - 2024-12-23

### Fixed

- Fixed Vite plugin `noExternal` configuration to match HonoX approach
- Changed from `noExternal: ["matchbox"]` to `noExternal: true` to prevent glob processing errors

## [0.2.x] - Previous Releases

- Initial implementation of Basic Authentication
- Basic URL rewriting with RewriteRule
- Simple Redirect directive support
- Session cookie configuration
- Custom middleware support
- Protected file access prevention

---

For the complete list of planned features, see [docs/roadmap.md](./docs/roadmap.md).
