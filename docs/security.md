# Security Considerations

This document outlines the security features and considerations for the Matchbox framework.

## Implemented Security Features

### 1. Session Cookie Security

Session cookies are configured with secure defaults:

- **HttpOnly**: Enabled by default to prevent XSS attacks from accessing session data
- **SameSite**: Set to "Lax" by default to provide CSRF protection while maintaining usability
- **Configurable Options**: Support for `Secure`, `Domain`, `MaxAge`, and custom `Path`

Example configuration:

```typescript
createCgi({
  sessionCookie: {
    secure: true,      // Enable for HTTPS in production
    sameSite: "Strict", // Stricter CSRF protection
    maxAge: 3600,       // 1 hour session timeout
  }
});
```

**Recommendation**: Always set `sessionCookie.secure: true` in production when using HTTPS.

Beyond the cookie _attributes_ above, the `$_SESSION` _contents_ can also be
signed: set `sessionSecret` to have Matchbox attach an HMAC-SHA256 signature
to the cookie, so a client that edits the (still-readable) session payload
gets an empty session on the next request instead of having the tampered
value accepted. See
[SEC-004](#sec-004-session-cookie-signing-is-opt-in-via-sessionsecret) below.

### 2. Protection Against Direct Access to Configuration Files

The framework's Hono middleware blocks access to sensitive configuration files:

- `.htaccess`
- `.htpasswd`
- `.htdigest`
- `.htgroup`

Any direct HTTP request to these files returns a 403 Forbidden response — **in
production builds**, where `MatchboxPlugin`'s `closeBundle` step also deletes
these files from the build output, so they aren't present to be served at all.

> **Known limitation (dev server only):** see
> [SEC-002](#sec-002-dev-server-may-serve-htaccess--htpasswd-as-static-files)
> below — under `@hono/vite-dev-server`, requests matching the `exclude`
> pattern bypass this middleware and are served directly by Vite's static
> file handling.

### 3. Basic Authentication Support

Built-in support for HTTP Basic Authentication through `.htpasswd` files:

- Credentials are verified on each request
- Realm-based authentication
- Directory-level protection

> **Known limitation:** see
> [SEC-005](#sec-005-htpasswd-only-supports-plain-text-passwords) below —
> only plain-text password matching is supported; hashed entries (bcrypt,
> `apr1`/MD5) produced by Apache's `htpasswd` tool will not authenticate.

### 4. Input Handling

- **File Upload Separation**: Files uploaded via multipart forms are automatically separated from regular POST data into `$_FILES`
- **Query Parameter Parsing**: GET and POST parameters are parsed and available through type-safe objects
- **Cookie Parsing**: Cookies are parsed and available through `$_COOKIE`
- **Request Body Size Limit**: Requests are capped at `maxBodySize` (default 10 MiB) before parsing; oversized bodies get a `413` without ever being read into memory. Pass `maxBodySize: 0` to disable the limit (not recommended for public-facing deployments). See [SEC/PER notes](#5-client-ip-resolution-trustproxy) below for other opt-in hardening options.

### 5. Client IP Resolution (`trustProxy`)

By default (`trustProxy: false`), `$_SERVER.REMOTE_ADDR`, the `%{REMOTE_ADDR}`
htaccess variable, and Allow/Deny IP rules all ignore the `X-Forwarded-For`
and `X-Real-IP` request headers, since those are attacker-controlled input
unless a trusted proxy overwrites them. Only set `trustProxy: true` when
Matchbox sits behind a reverse proxy you control that strips/overwrites these
headers before forwarding — see
[SEC-003](#sec-003-x-forwarded-for-trust-is-opt-in) below.

### 6. Environment Variables Are Not Exposed via `$_SERVER`

`$_SERVER` contains only request metadata (method, URI, headers-derived
fields, etc.) and `cgiinfo()` only renders `$_SERVER`/`$_SESSION`/`$_REQUEST`/
config — neither ever includes the process's environment variables. Read
environment variables from `context.$_ENV` instead, and treat that value as
sensitive in the same way you would `process.env`. See
[SEC-010](#sec-010-_server-and-cgiinfo-no-longer-include-environment-variables-breaking)
below.

## Security Best Practices

### 1. Session Management

- Use `sessionCookie.secure: true` in production
- Set appropriate `sessionCookie.maxAge` to limit session lifetime
- Consider using `sessionCookie.sameSite: "Strict"` for high-security applications
- Set `sessionSecret` in production so `$_SESSION` cookies are HMAC-signed and tamper-evident (see [SEC-004](#sec-004-session-cookie-signing-is-opt-in-via-sessionsecret))

### 2. Error Handling

- Error messages in production should not expose sensitive information
- By default (`debug: false`), the runtime error page shows a generic "Internal Server Error" — stack traces are withheld from the response body. Pass `debug: true` only in trusted development environments to see the original message/stack in the page. See [SEC-006](#sec-006-error-page-detail-is-opt-in-via-debug) below
- Use the custom logger option to control logging behavior — the original error (including its stack trace) is always passed to `logger`, regardless of `debug`

### 3. Input Validation

Always validate and sanitize user input:

```typescript
export default (context: CgiContext) => {
  const { $_POST, $_GET } = context;

  // Validate input
  const email = $_POST.email;
  if (!email || !isValidEmail(email)) {
    context.status(400);
    return "Invalid email";
  }

  // Process safely...
};
```

### 4. Content Security

Use proper Content-Type headers:

```typescript
export default (context: CgiContext) => {
  // For JSON responses
  context.header("Content-Type", "application/json");
  return { data: "safe" };

  // For HTML, the framework uses Hono's html escaping by default
};
```

### 5. File Uploads

When handling file uploads, validate:

- File types
- File sizes
- File names (to prevent path traversal)

```typescript
export default async (context: CgiContext) => {
  const { $_FILES } = context;
  const upload = $_FILES.file as File;

  // Validate file type
  if (!upload.type.startsWith('image/')) {
    context.status(400);
    return "Invalid file type";
  }

  // Validate file size (e.g., 5MB limit)
  if (upload.size > 5 * 1024 * 1024) {
    context.status(400);
    return "File too large";
  }

  // Process file safely...
};
```

## Opt-In Hardening

These items were previously implicit/always-on behavior with security
trade-offs; they are now configurable via `MatchboxOptions`. Defaults were
chosen to be secure-by-default without breaking existing deployments (SEC-010
is the one exception — see below).

### SEC-003: X-Forwarded-For Trust Is Opt-In

Prior versions trusted `X-Forwarded-For`/`X-Real-IP` unconditionally when
resolving the client IP for `$_SERVER.REMOTE_ADDR`, the `%{REMOTE_ADDR}`
htaccess variable, and Allow/Deny IP rules. Since these headers are ordinary
request input, any client could set them directly and spoof its IP to bypass
IP-based access control.

`trustProxy` now defaults to `false`: these headers are ignored, and the
resolved IP falls back to whatever the runtime exposes via `c.env.REMOTE_ADDR`
(or `127.0.0.1` if nothing is available). Set `trustProxy: true` only when
Matchbox is deployed behind a reverse proxy that you control and that
overwrites/strips these headers from client-supplied values before
forwarding — otherwise `trustProxy: true` reintroduces the spoofing risk.

All three call sites (`$_SERVER.REMOTE_ADDR`, htaccess `%{REMOTE_ADDR}`, and
Allow/Deny matching) share a single resolver (`resolveClientIp` in
`src/htaccess/utils.ts`) so they always agree on the same client IP for a
given request and `trustProxy` setting.

### SEC-004: Session Cookie Signing Is Opt-In via `sessionSecret`

`$_SESSION` is serialized to a cookie without any integrity protection by
default (as in prior versions) — a client can edit the (URL-decoded, JSON)
cookie value and have the tampered data accepted on the next request.

Set `sessionSecret` to have Matchbox attach an HMAC-SHA256 signature to the
cookie (`base64url(payload).base64url(hmac)`, computed with Web Crypto so it
works on Node, Bun, and Cloudflare Workers alike). On read, the signature is
verified before the payload is parsed; a missing/incorrect signature (or a
legacy unsigned cookie from before `sessionSecret` was configured) is treated
as tampered and yields an empty session rather than trusting the value. This
does not encrypt the payload — don't store secrets in `$_SESSION`, only use
signing to detect tampering.

When `sessionSecret` is not configured, a one-time warning is logged (via
`logger`, if configured) recommending it be set in production.

### SEC-006: Error Page Detail Is Opt-In via `debug`

Prior versions always rendered the thrown error's message and stack trace in
the 500 response body. `debug` now defaults to `false`: the page shows a
generic "Internal Server Error" instead, and the original error (message +
stack) is only ever sent to `logger` (if configured), not to the client. Pass
`debug: true` to restore the previous behavior for local development.

### SEC-010: `$_SERVER` and `cgiinfo()` No Longer Include Environment Variables (Breaking)

Prior versions merged the entire environment (`process.env` on Node/Bun, or
`c.env` on Workers) into `$_SERVER`, and `cgiinfo()` rendered that merged
object under a "$_SERVER (Environment)" section — meaning any code with
access to `$\_SERVER`, or anyone who could view a page calling `cgiinfo()`,
could read every environment variable, including secrets never intended for
client-facing output.

`$_SERVER` now contains **only** request metadata (`REQUEST_METHOD`,
`REQUEST_URI`, `REMOTE_ADDR`, `USER_AGENT`, `SCRIPT_NAME`, `PATH_INFO`,
`QUERY_STRING`); it no longer has environment variables mixed in, and
`cgiinfo()`'s "$\_SERVER" section only shows this metadata.

**This is a breaking change** if your pages read environment variables via
`context.$_SERVER.SOME_VAR` — read them from `context.$_ENV` instead, which
is unaffected and still exposes the full environment as before. See the
[Changelog](../CHANGELOG.md) for migration notes.

## Known Limitations and Future Improvements

### SEC-001: Auth Directives Are Parsed But Not Enforced

`.htaccess` directives `AuthType`, `AuthName`, `AuthUserFile`, `AuthGroupFile`,
and `Require` (`Require valid-user`, `Require user ...`, `Require group ...`,
`Require ip ...`, `Require host ...`, `Require all granted/denied`) are parsed
into the `authConfig` property of the resulting `HtaccessConfig`, but
**Matchbox does not enforce them automatically**. Writing these directives
into a `.htaccess` file, by itself, does **not** protect the directory.

Real Basic Auth enforcement in Matchbox works differently: it is driven by
the physical presence of a `.htpasswd` file in a directory under your
`publicDir`. `applyBasicAuth` builds one `hono/basic-auth` middleware per
directory that has a `.htpasswd` file and applies it to that directory and
its subdirectories — independent of any `AuthType`/`Require` lines in
`.htaccess`.

If you need to act on the parsed `authConfig` (e.g. IP or host-based rules),
read it from `HtaccessConfig` and implement your own enforcement in custom
middleware; see [`.htaccess` guide](./htaccess.md#authentication--authorization)
for the parsed shape. Only `Order`/`Allow`/`Deny` (Apache 2.2-style access
control) is fully enforced today.

### SEC-002: Dev Server May Serve `.htaccess` / `.htpasswd` as Static Files

In production builds this is not a concern: `MatchboxPlugin`'s `closeBundle`
step deletes `.htaccess`, `.htpasswd`, `.htdigest`, and `.htgroup` files from
the build output directory, and Matchbox's protected-files middleware also
returns 403 for direct requests to them.

During local development with `@hono/vite-dev-server`, however, paths that
match the dev server's `exclude` option (commonly `/^\/public\/.+/` per the
[Quick Start](../README.md#1-configure-vite) example) are routed to Vite's
own static file serving instead of the Hono app — bypassing Matchbox's
protected-files middleware entirely. If a `.htaccess` or `.htpasswd` file
physically exists under `publicDir`, a request to its literal path (e.g.
`/admin/.htpasswd`) can be served as plain text by the dev server.

This is a development-only exposure, but it means plain-text credentials in
`.htpasswd` (see SEC-005) could be read by anyone who can reach the dev
server. Avoid exposing the Vite dev server (e.g. via `--host` or port
forwarding) on shared or public networks, and treat any credentials placed in
`.htpasswd` during development as non-secret.

### SEC-005: `.htpasswd` Only Supports Plain-Text Passwords

Matchbox's `.htpasswd` parser (`src/middleware/auth.ts`) checks credentials
with a plain string equality comparison — it does **not** verify Apache's
standard hash formats (`apr1`/MD5, `bcrypt`, `crypt`). Running Apache's
`htpasswd` tool (e.g. `htpasswd -c .htpasswd username`) produces a hashed
entry that will **not** authenticate against Matchbox. Write the password in
plain text instead:

```
admin:my-plain-text-password
```

Because credentials are stored and compared in plain text, treat `.htpasswd`
files as sensitive: don't reuse passwords from other systems, and keep in
mind the dev-server exposure described in SEC-002 above.

### Other Current Limitations

1. **Digest Authentication**: `.htdigest` files are recognized and blocked from direct access, but digest authentication is not yet implemented. Use Basic Authentication with HTTPS instead.

2. **Group Authorization**: `.htgroup` files are recognized but group-based authorization is not yet implemented.

3. **CSRF Tokens**: The framework relies on SameSite cookies for CSRF protection. For additional security, implement CSRF tokens in your application layer.

4. **Rate Limiting**: No built-in rate limiting. Implement at the reverse proxy level or use custom middleware.

5. **Content Security Policy**: No built-in CSP headers. Add them via custom middleware:
   ```typescript
   createCgi({
     middleware: [
       async (c, next) => {
         c.header("Content-Security-Policy", "default-src 'self'");
         await next();
       }
     ]
   });
   ```

### Planned Security Improvements

See [docs/roadmap.md](./roadmap.md) for planned security-related features.

## Security Reporting

If you discover a security vulnerability, please report it to the project maintainers. Do not open public issues for security vulnerabilities.

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Hono Security Best Practices](https://hono.dev/docs/guides/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
