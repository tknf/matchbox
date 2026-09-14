# Matchbox

A modern CGI-style web framework built on [Hono](https://hono.dev). Brings Apache-style conventions (`.htaccess`, `.htpasswd`) into the modern TypeScript/JSX ecosystem with file-based routing and familiar CGI variables.

## Features

- **File-based routing** - `.cgi.tsx`/`.cgi.jsx` files map directly to URL endpoints
- **CGI-style context** - Familiar `$_GET`, `$_POST`, `$_SESSION`, `$_SERVER`, `$_COOKIE`, etc.
- **Apache compatibility** - `.htaccess` for rewrites/redirects/headers, `.htpasswd` for Basic Auth
- **Modern tooling** - Full TypeScript support, Vite integration, JSX rendering
- **Flexible configuration** - Session management, custom middleware, security headers
- **Production ready** - Comprehensive test coverage, security best practices

## Installation

Matchbox 1.x requires **Vite 8**, including Vite 8-based Vite+ toolchains.
Vite 7 and earlier are no longer supported.

```bash
pnpm add @tknf/matchbox hono
pnpm add -D vite@^8 @hono/vite-dev-server
```

## Quick Start

### 1. Configure Vite

Create `vite.config.ts`. In a Vite+ project, import `defineConfig` from
`"vite-plus"` instead of `"vite"`.

```typescript
import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";
import { MatchboxPlugin } from "@tknf/matchbox/plugin";

export default defineConfig({
  plugins: [
    MatchboxPlugin(),
    devServer({
      entry: "server.ts",
      exclude: [/^\/public\/.+/, /^\/favicon\.ico$/],
    }),
  ],
});
```

### 2. Create Server Entry

Create `server.ts`:

```typescript
import { createCgi } from "@tknf/matchbox";

export default createCgi();
```

### 3. Create Your First Page

Create `public/index.cgi.tsx`:

```tsx
import type { CgiContext } from "@tknf/matchbox";

export default function ({ $_SERVER, $_GET }: CgiContext) {
  return (
    <html>
      <head>
        <title>Matchbox</title>
      </head>
      <body>
        <h1>Hello from Matchbox!</h1>
        <p>Request Method: {$_SERVER.REQUEST_METHOD}</p>
        <p>Query Params: {JSON.stringify($_GET)}</p>
      </body>
    </html>
  );
}
```

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` to see your page.

## CGI Context

Every page function receives a `CgiContext` object with:

### Request Data

- `$_GET` - Query parameters
- `$_POST` - Form data (POST/PUT)
- `$_FILES` - Uploaded files
- `$_REQUEST` - Combined `$_GET` + `$_POST` + `$_COOKIE`
- `$_COOKIE` - Cookie values
- `$_SERVER` - Server and request information
- `$_ENV` - Environment variables
- `$_SESSION` - Session data

### Helper Functions

- `header(name, value)` - Set response header
- `status(code)` - Set HTTP status code
- `redirect(url, status?)` - Redirect to another URL
- `cgiinfo()` - HTML debug info block
- `get_modules()` - List all available CGI modules
- `get_version()` - Get Matchbox version string
- `log(message)` - Custom logging
- `request_headers()` - Get all request headers
- `response_headers()` - Get current response headers

### Example Usage

```tsx
export default function (ctx: CgiContext) {
  const { $_GET, $_POST, $_SESSION, header, status, redirect } = ctx;

  // Handle form submission
  if ($_POST.username) {
    $_SESSION.user = $_POST.username;
    return redirect("/dashboard");
  }

  // Set custom headers
  header("X-Custom-Header", "value");
  status(200);

  return <div>Welcome</div>;
}
```

## Configuration

### Plugin Options

```typescript
MatchboxPlugin({
  publicDir: "public",        // Directory for .cgi files (default: "public")
  config: {                   // Custom config object injected into pages
    siteName: "My Site",
    apiUrl: "https://api.example.com"
  }
});
```

Access config in your pages via `context.config`.

### Runtime Options

```typescript
createCgi({
  // Session cookie configuration
  sessionCookie: {
    name: "_SESSION_ID",      // Cookie name (default: "_SESSION_ID")
    path: "/",                // Cookie path (default: "/")
    domain: "example.com",    // Cookie domain
    secure: true,             // HTTPS only (default: false)
    sameSite: "Strict",       // CSRF protection: "Strict" | "Lax" | "None"
    maxAge: 3600,             // Session timeout in seconds
  },

  // URL trailing slash enforcement
  enforceTrailingSlash: true,

  // Custom middleware (runs before page handlers)
  middleware: [
    async (c, next) => {
      c.header("X-App", "matchbox");
      await next();
    },
  ],

  // Custom logger
  logger: (message, level) => {
    console.log(`[${level ?? "info"}] ${message}`);
  },

  // Trust X-Forwarded-For/X-Real-IP when resolving the client IP
  // (default: false - only enable behind a reverse proxy you control)
  trustProxy: false,

  // Sign the $_SESSION cookie with HMAC-SHA256 so clients can't tamper
  // with it (recommended in production; default: unsigned)
  sessionSecret: process.env.SESSION_SECRET,

  // Maximum accepted request body size in bytes (default: 10 MiB; 0 disables the limit)
  maxBodySize: 10 * 1024 * 1024,

  // Respond 504 if a page handler takes longer than this (default: no timeout)
  handlerTimeoutMs: 30_000,

  // Include error message/stack trace in the error page (default: false)
  debug: process.env.NODE_ENV !== "production",
});
```

See [Security Guide](./docs/security.md) for the security rationale behind
`trustProxy`, `sessionSecret`, and `debug`.

## Apache-Style Features

### Basic Authentication (.htpasswd)

Place a `.htpasswd` file in any directory under `public/` to protect it:

```
admin:plaintext-password
user:another-password
```

All files in that directory and subdirectories will require authentication.

> **Note:** Matchbox only supports **plain-text** passwords in `.htpasswd` —
> it does not verify bcrypt/`apr1` (MD5) hashes. Apache's `htpasswd` command
> generates hashed entries by default, which will **not** authenticate here;
> write the password in plain text instead. See
> [Security Guide](./docs/security.md#sec-005-htpasswd-only-supports-plain-text-passwords) for details.

### URL Rewriting and Redirects (.htaccess)

Create `.htaccess` files to configure rewrites, redirects, headers, and error pages:

```apache
# Permanent redirect
Redirect 301 /old-page /new-page

# Conditional rewrite
RewriteCond %{HTTP_HOST} ^www\.example\.com$
RewriteRule ^(.*)$ https://example.com/$1 [R=301,L]

# Pattern-based rewrite
RewriteRule ^blog/(.+)$ /posts.cgi?slug=$1 [QSA,L]

# Forbidden
RewriteRule ^private$ - [F]

# Security headers
Header set X-Frame-Options "SAMEORIGIN"
Header set X-Content-Type-Options "nosniff"
Header set Strict-Transport-Security "max-age=31536000"

# Custom error pages (external URL redirect only, see note below)
ErrorDocument 404 https://example.com/errors/404.html
ErrorDocument 500 https://example.com/errors/500.html
```

> **Note:** `ErrorDocument` currently only supports **external URLs**
> (`http://`/`https://`), which trigger a redirect. Local paths (e.g.
> `/errors/404.html`) are parsed but **not served** — Matchbox returns a
> plain `Error 404: See /errors/404.html` text response instead of the file
> contents. See [`.htaccess` guide](./docs/htaccess.md#error-handling) for
> details.

#### Supported RewriteRule Flags

- `[L]` - Last rule, stop processing
- `[R]` / `[R=301]` / `[R=302]` - Redirect with status code
- `[F]` - Forbidden (403)
- `[G]` - Gone (410)
- `[NC]` - No Case (case-insensitive)
- `[QSA]` - Query String Append
- `[QSD]` - Query String Discard
- `[NE]` - No Escape

#### Supported RewriteCond Variables

- `%{HTTP_HOST}` - Request host
- `%{HTTP_USER_AGENT}` - User agent
- `%{HTTP_REFERER}` - Referer header
- `%{REQUEST_URI}` - Request URI
- `%{REQUEST_METHOD}` - HTTP method
- `%{QUERY_STRING}` - Query string
- `%{REMOTE_ADDR}` - Client IP
- And more... (see [documentation](./docs/htaccess.md))

## Examples

Check out the [`examples/`](./examples) directory for complete working examples:

- **basic** - Minimal setup with a simple page
- **htaccess-auth** - Authentication and URL rewriting
- **file-upload** - Handling file uploads via `$_FILES`
- **session** - Session management and stateful pages

## Documentation

- [Apache .htaccess Features](./docs/htaccess.md) - Complete `.htaccess` feature reference
- [Security Guide](./docs/security.md) - Security best practices
- [API Reference](./docs/api.md) - Complete API documentation
- [Roadmap](./docs/roadmap.md) - Planned features and improvements

## Migration to v1.0.0

- Upgrade the application's Vite dependency to version 8, or use a Vite 8-based
  Vite+ toolchain, before updating Matchbox from 0.x to 1.x.
- `MatchboxPlugin` now configures the automatic Hono JSX runtime with
  `oxc.jsx.runtime` and `oxc.jsx.importSource`. Remove redundant `esbuild` JSX
  settings from your Vite config; if you customize them, migrate those overrides
  to `oxc.jsx` as described in the [Vite migration guide](https://vite.dev/guide/migration#javascript-transforms-by-oxc).
- Existing `MatchboxPlugin()` calls, CGI pages, and import paths continue to work
  with the updated toolchain.
- Review the other breaking changes in [CHANGELOG.md](./CHANGELOG.md#unreleased),
  including reading environment variables through `$_ENV` instead of `$_SERVER`.

## Migration from v0.2.x

Version 0.3.0 introduced enhanced `.htaccess` parsing. If you're upgrading:

- ✅ Existing `.htaccess` files work without changes
- ✅ Both `[R=301]` and `R=301` flag syntaxes are supported
- ⚠️ Malformed directives now throw errors (previously silently ignored)

See the [migration guide](./docs/htaccess.md#migration-from-v02x-to-v030) for details.

## Development

Development uses Vite+ through pnpm scripts. Use the Node.js version in
`.node-version`; the library and examples share one pnpm workspace.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for Zed and pre-commit hook setup.

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm run build

# Format, lint, and type check
pnpm check
```

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please read the [contributing guidelines](./CONTRIBUTING.md) before submitting PRs.

## Links

- [GitHub Repository](https://github.com/tknf-labs/matchbox)
- [NPM Package](https://www.npmjs.com/package/@tknf/matchbox)
- [Hono Framework](https://hono.dev)
