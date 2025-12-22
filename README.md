# Matchbox

A simple CGI-style web server framework built on top of Hono. Treats `.cgi.tsx` / `.cgi.jsx` files under `public/` as pages, and brings Apache-style conventions like `.htaccess` and `.htpasswd` into modern tooling.

## Features

- File-based routing (`.cgi.tsx` / `.cgi.jsx` map directly to endpoints)
- CGI-style context (`$_GET`, `$_POST`, `$_SESSION`, etc.)
- `.htaccess` rewrites/redirects and `.htpasswd` Basic Auth
- Session cookie configuration and custom middleware
- Vite + TypeScript + JSX support

## Install

```bash
pnpm add matchbox hono
```

## Quick Start

`vite.config.ts`:

```ts
import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite";
import { MatchboxPlugin } from "matchbox/plugin";

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

`server.ts`:

```ts
import { createCgi } from "matchbox";

export default createCgi();
```

`public/index.cgi.tsx`:

```tsx
import type { CgiContext } from "matchbox";

export default function ({ $_SERVER }: CgiContext) {
  return (
    <html>
      <head>
        <title>Matchbox</title>
      </head>
      <body>
        <h1>Hello Matchbox</h1>
        <p>Method: {$_SERVER.REQUEST_METHOD}</p>
      </body>
    </html>
  );
}
```

Start the dev server:

```bash
pnpm dev
```

## CGI Context

Page functions receive a `CgiContext`.

- `$_GET` / `$_POST` / `$_FILES` / `$_REQUEST`
- `$_SESSION` / `$_COOKIE` / `$_ENV` / `$_SERVER`
- `header(name, value)` / `status(code)` / `redirect(url, status?)`
- `cgiinfo()` / `get_modules()` / `get_version()`

## Configuration

### MatchboxPlugin

```ts
MatchboxPlugin({
  publicDir: "public",
  config: { siteName: "My Site" },
});
```

- `publicDir`: Root directory for page discovery (default: `public`)
- `config`: Configuration object injected into pages

### createCgi

```ts
createCgi({
  sessionCookie: {
    name: "_SESSION_ID",
    sameSite: "Lax",
    secure: true,
    maxAge: 3600,
  },
  enforceTrailingSlash: true,
  middleware: [
    async (c, next) => {
      c.header("X-App", "matchbox");
      await next();
    },
  ],
  logger: (message, level) => {
    console.log(`[${level ?? "info"}] ${message}`);
  },
});
```

## Auth and Rewrites

Place these under `public/` to enable them.

- `.htpasswd`: Directory-level Basic Auth
- `.htaccess`: Simple `RewriteRule` / `Redirect` support

## References

- Examples: `examples/README.md`
- Security: `docs/security.md`

## License

MIT License. See `LICENSE` for details.
