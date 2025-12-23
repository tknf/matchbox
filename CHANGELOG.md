# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2024-12-24

### Breaking Changes

- **BREAKING:** Changed the fourth parameter of `createCgiWithPages` from `RewriteMap` to `HtaccessConfig` type
  - Migration: Use the new `parseHtaccess()` function or continue using `.htaccess` files (automatic migration)
  - See [Migration Guide](./docs/htaccess-features.md#migration-from-v02x-to-v03) for details
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
- ✨ **ErrorDocument** - Custom error pages for HTTP status codes
  - Support for 4xx and 5xx error codes
  - Serve custom HTML error pages from your public directory
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
  - [Apache .htaccess Features Reference](./docs/htaccess-features.md) - Complete feature list
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

See the [full migration guide](./docs/htaccess-features.md#migration-from-v02x-to-v03) for more details.

## [0.2.6] - 2024-12-XX

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

For the complete list of planned features, see [docs/htaccess-features.md](./docs/htaccess-features.md).
