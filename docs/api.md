# API Reference

Complete API documentation for Matchbox.

## Table of Contents

- [Core Functions](#core-functions)
- [Types](#types)
- [Plugin API](#plugin-api)
- [Context API](#context-api)
- [Middleware API](#middleware-api)

## Core Functions

### `createCgi(options?)`

Creates a Hono application with CGI-style routing based on `.cgi.tsx`/`.cgi.jsx` files in the `public/` directory.

```typescript
import { createCgi } from "@tknf/matchbox";

const app = createCgi({
  sessionCookie?: SessionCookieOptions;
  enforceTrailingSlash?: boolean;
  middleware?: Array<Middleware>;
  logger?: Logger;
});
```

**Parameters:**

- `options` (optional) - Configuration options

**Returns:** `Hono` application instance

### `createCgiWithPages(pages, config, authMap, htaccessConfig, options?)`

Low-level function to create a CGI application with explicit page definitions. Useful for testing or custom setups.

```typescript
import { createCgiWithPages } from "@tknf/matchbox";

const app = createCgiWithPages(
  pages,              // Array of Page objects
  config,             // Configuration object
  authMap,            // Authentication map
  htaccessConfig,     // .htaccess configuration
  options             // Runtime options
);
```

**Parameters:**

- `pages`: `Page[]` - Array of page definitions
- `config`: `ConfigObject` - Site configuration object
- `authMap`: `Record<string, string>` - Directory → .htpasswd content map
- `htaccessConfig`: `HtaccessConfig` - Directory → .htaccess config map
- `options`: `MatchboxOptions` - Runtime options

**Returns:** `Hono` application instance

## Types

### `CgiContext`

The context object passed to every page function.

```typescript
interface CgiContext {
  // Request data
  $_GET: Record<string, string>;
  $_POST: Record<string, string>;
  $_FILES: Record<string, File | File[]>;
  $_REQUEST: Record<string, string>;
  $_COOKIE: Record<string, string>;
  $_SERVER: Record<string, unknown>;
  $_ENV: Record<string, unknown>;
  $_SESSION: Record<string, unknown>;

  // Configuration
  config: ConfigObject;

  // Hono context
  c: Context;

  // Helper functions
  header(name: string, value: string): void;
  status(code: number): void;
  redirect(url: string, status?: number): RedirectObject;
  cgiinfo(): HtmlEscapedString;
  request_headers(): Record<string, string>;
  response_headers(): Record<string, string>;
  log(message: string): void;
  get_version(): string;
  get_modules(): ModuleInfo[];
}
```

### `MatchboxOptions`

Configuration options for `createCgi()`.

```typescript
interface MatchboxOptions {
  sessionCookie?: SessionCookieOptions;
  enforceTrailingSlash?: boolean;
  middleware?: Array<(c: Context, next: () => Promise<void>) => Promise<Response | undefined>>;
  logger?: (message: string, level?: "info" | "warn" | "error") => void;
}
```

### `SessionCookieOptions`

Session cookie configuration.

```typescript
interface SessionCookieOptions {
  name?: string;        // Cookie name (default: "_SESSION_ID")
  path?: string;        // Cookie path (default: "/")
  domain?: string;      // Cookie domain
  secure?: boolean;     // HTTPS only (default: false)
  sameSite?: "Strict" | "Lax" | "None";  // CSRF protection (default: "Lax")
  maxAge?: number;      // Session timeout in seconds
}
```

### `Page`

Page definition for `createCgiWithPages()`.

```typescript
interface Page {
  urlPath: string;      // URL path (e.g., "/index.cgi")
  dirPath: string | null;  // Directory path for index pages (e.g., "/")
  component: (context: CgiContext) => any | Promise<any>;
}
```

### `ModuleInfo`

Information about a loaded CGI module.

```typescript
interface ModuleInfo {
  urlPath: string;      // URL where module is accessible
  dirPath: string | null;  // Directory path for index modules
}
```

### `HtaccessConfig`

Parsed `.htaccess` configuration.

```typescript
type HtaccessConfig = Record<string, DirectoryConfig>;

interface DirectoryConfig {
  rewriteRules: RewriteRuleConfig[];
  redirects: RedirectConfig[];
  errorDocuments: ErrorDocumentConfig[];
  headers: HeaderConfig[];
  accessControl?: AccessControlConfig;
  authConfig?: AuthConfig;
}
```

## Plugin API

### `MatchboxPlugin(options?)`

Vite plugin for Matchbox.

```typescript
import { MatchboxPlugin } from "@tknf/matchbox/plugin";

export default defineConfig({
  plugins: [
    MatchboxPlugin({
      publicDir?: string;
      config?: Record<string, any>;
    })
  ]
});
```

**Options:**

- `publicDir` - Directory to scan for `.cgi` files (default: `"public"`)
- `config` - Configuration object injected into `context.config`

## Context API

### Request Data

#### `$_GET`

Query parameters from the URL.

```typescript
// URL: /page.cgi?name=John&age=30
const { name, age } = context.$_GET;
// name = "John", age = "30"
```

#### `$_POST`

Form data from POST/PUT requests (excluding files).

```typescript
const { username, password } = context.$_POST;
```

#### `$_FILES`

Uploaded files from multipart/form-data requests.

```typescript
const { avatar } = context.$_FILES;
if (avatar instanceof File) {
  const buffer = await avatar.arrayBuffer();
}
```

#### `$_REQUEST`

Combined `$_COOKIE` + `$_GET` + `$_POST` (in that order of precedence).

```typescript
const value = context.$_REQUEST.param;
```

#### `$_COOKIE`

Cookie values.

```typescript
const sessionId = context.$_COOKIE._SESSION_ID;
```

#### `$_SERVER`

Server and request information.

```typescript
const {
  REQUEST_METHOD,    // "GET", "POST", etc.
  REQUEST_URI,       // Full request URL
  REMOTE_ADDR,       // Client IP address
  USER_AGENT,        // User agent string
  SCRIPT_NAME,       // CGI script path
  PATH_INFO,         // Path after script name
  QUERY_STRING,      // Raw query string
} = context.$_SERVER;
```

#### `$_ENV`

Environment variables (Node.js `process.env` or Cloudflare Workers env).

```typescript
const apiKey = context.$_ENV.API_KEY;
```

#### `$_SESSION`

Session data stored in cookie.

```typescript
// Set session data
context.$_SESSION.userId = "123";
context.$_SESSION.isAdmin = true;

// Read session data
if (context.$_SESSION.isLoggedIn) {
  // ...
}
```

**Note:** Session data is automatically serialized/deserialized as JSON and stored in an HttpOnly cookie.

### Helper Functions

#### `header(name, value)`

Set a response header.

```typescript
context.header("Content-Type", "application/json");
context.header("Cache-Control", "no-cache");
```

#### `status(code)`

Set the HTTP status code.

```typescript
context.status(404);
context.status(201);
```

#### `redirect(url, status?)`

Redirect to another URL.

```typescript
// 302 redirect (default)
return context.redirect("/login");

// 301 permanent redirect
return context.redirect("/new-url", 301);
```

#### `cgiinfo()`

Returns an HTML debug block with request information.

```typescript
return (
  <div>
    <h1>Debug Info</h1>
    {context.cgiinfo()}
  </div>
);
```

#### `request_headers()`

Get all request headers as an object.

```typescript
const headers = context.request_headers();
console.log(headers["user-agent"]);
```

#### `response_headers()`

Get current response headers.

```typescript
const headers = context.response_headers();
console.log(headers["content-type"]);
```

#### `log(message)`

Log a message using the custom logger (if configured) or `console.log`.

```typescript
context.log("User logged in");
```

#### `get_version()`

Get the Matchbox version string.

```typescript
const version = context.get_version();
// "MatchboxCGI/v0.3.0"
```

#### `get_modules()`

Get a list of all loaded CGI modules.

```typescript
const modules = context.get_modules();
// [
//   { urlPath: "/index.cgi", dirPath: "/" },
//   { urlPath: "/admin/dashboard.cgi", dirPath: null },
// ]
```

## Middleware API

### Custom Middleware

Middleware functions receive the Hono context and a `next()` function.

```typescript
import { createCgi } from "@tknf/matchbox";

const app = createCgi({
  middleware: [
    async (c, next) => {
      // Before page handler
      console.log(`Request: ${c.req.method} ${c.req.path}`);

      // Call page handler
      const result = await next();

      // After page handler
      c.header("X-Response-Time", `${Date.now() - start}ms`);

      // Optionally return early
      if (c.req.path === "/blocked") {
        return c.text("Forbidden", 403);
      }

      return result;
    }
  ]
});
```

### Built-in Middleware

Matchbox includes several built-in middleware that are automatically applied:

- **Protected Files** - Blocks access to `.htaccess`, `.htpasswd`, `.htdigest`, `.htgroup`
- **Trailing Slash** - Enforces trailing slashes if `enforceTrailingSlash` is enabled
- **Headers** - Applies `Header` directives from `.htaccess`
- **Rewrite/Redirect** - Applies `RewriteRule` and `Redirect` directives
- **Access Control** - Enforces `Order`/`Allow`/`Deny` directives
- **Basic Auth** - Enforces `.htpasswd` authentication
- **Error Documents** - Serves custom error pages from `ErrorDocument` directives

## .htaccess Parsing

### `parseHtaccess(content)`

Parse `.htaccess` file content into a configuration object.

```typescript
import { parseHtaccess } from "@tknf/matchbox";

const config = parseHtaccess(`
  Redirect 301 /old /new
  RewriteRule ^blog/(.+)$ /posts.cgi?slug=$1 [QSA,L]
  Header set X-Frame-Options "SAMEORIGIN"
  ErrorDocument 404 /errors/404.html
`);

// Returns DirectoryConfig object
```

### Security Headers Helpers

```typescript
import { securityHeaders } from "@tknf/matchbox";

const headers = [
  securityHeaders.xFrameOptions("SAMEORIGIN"),
  securityHeaders.xContentTypeOptions(),
  securityHeaders.xssProtection(true),
  securityHeaders.hsts(31536000, true),
  securityHeaders.csp("default-src 'self'"),
  securityHeaders.referrerPolicy("strict-origin-when-cross-origin"),
  securityHeaders.permissionsPolicy("geolocation=(), microphone=()"),
];
```

## Error Handling

### Automatic Error Responses

Matchbox automatically handles errors:

```typescript
export default function (ctx: CgiContext) {
  throw new Error("Something went wrong");
  // Returns 500 with error message in development
  // Returns generic 500 in production
}
```

### Custom Error Pages

Use `ErrorDocument` directive in `.htaccess`:

```apache
ErrorDocument 404 /errors/404.html
ErrorDocument 500 /errors/500.html
```

Or handle errors in your page:

```typescript
export default function (ctx: CgiContext) {
  const id = ctx.$_GET.id;

  if (!id) {
    ctx.status(400);
    return <div>Bad Request: Missing ID</div>;
  }

  // ... rest of handler
}
```

## Examples

See the [examples/](../examples) directory for complete working examples.
