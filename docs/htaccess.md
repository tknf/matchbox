# Apache .htaccess Features Reference

## Currently Implemented Features (v0.3.0)

- ✅ **Basic Authentication** (.htpasswd)
- ✅ **URL Rewriting** (RewriteRule with pattern, target, and comprehensive flags)
- ✅ **RewriteCond** - Conditional URL rewriting with variable expansion
- ✅ **Complete RewriteRule Flags** - [L], [R], [F], [G], [NC], [QSA], [QSD], [NE]
- ✅ **Redirects** (Redirect directive with status code)
- ⚠️ **ErrorDocument** - External URL redirect on matching status codes (local paths parsed but not served, see [Error Handling](#error-handling))
- ✅ **Security Headers** (Header directive with set/append/unset actions)
- ✅ **CORS Headers** (Access-Control-\* headers with helper functions)
- ✅ **Auth Directives** (AuthType, AuthName, Require - parsing only)
- ✅ **Access Control** (Order/Allow/Deny - Apache 2.2 style, fully enforced)

## Migration from v0.2.x to v0.3.0

### Breaking Changes

**Type Change: `RewriteMap` → `HtaccessConfig`**

The fourth parameter of `createCgiWithPages` has changed from `RewriteMap` to `HtaccessConfig`:

```typescript
// v0.2.x (Old)
type RewriteMap = Record<string, Array<{
  type: "redirect" | "rewrite";
  pattern?: string;
  source?: string;
  target: string;
  code?: string;
  flags?: string;
}>>;

// v0.3.0 (New)
type HtaccessConfig = Record<string, DirectoryConfig>;

interface DirectoryConfig {
  rewriteRules: RewriteRuleConfig[];
  redirects: RedirectConfig[];
  errorDocuments: ErrorDocumentConfig[];
  headers: HeaderConfig[];
  authConfig?: AuthConfig;
  accessControl?: AccessControlConfig;
}
```

**Migration Steps:**

If you were manually constructing the configuration object:

```typescript
// Old way (v0.2.x)
const rewriteMap = {
  "/": [
    { type: "redirect", code: "301", source: "/old", target: "/new" },
    { type: "rewrite", pattern: "^/api", target: "/api.cgi", flags: "L" }
  ]
};

// New way (v0.3.0)
import { parseHtaccess } from "@tknf/matchbox";

const htaccessConfig = {
  "/": parseHtaccess(`
    Redirect 301 /old /new
    RewriteRule ^/api /api.cgi [L]
  `)
};
```

**If using `.htaccess` files:** No migration needed! The `createCgi()` function automatically parses `.htaccess` files using the new parser.

### New .htaccess Syntax Support

**RewriteCond:**

```apache
RewriteCond %{HTTP_HOST} ^www\.example\.com$
RewriteRule ^(.*)$ https://example.com/$1 [R=301,L]
```

**Complete Flag Support:**

```apache
RewriteRule ^forbidden$ - [F]           # 403 Forbidden
RewriteRule ^gone$ - [G]                # 410 Gone
RewriteRule ^api /api.cgi [NC,QSA,L]    # Case-insensitive, append query string, last
```

**ErrorDocument:**

```apache
ErrorDocument 404 /errors/404.html
ErrorDocument 500 /errors/500.html
```

**Security Headers:**

```apache
Header set X-Frame-Options "SAMEORIGIN"
Header set Content-Security-Policy "default-src 'self'"
Header set Strict-Transport-Security "max-age=31536000"
```

### Supported Variables in RewriteCond

The following Apache server variables are supported in `%{VARIABLE}` syntax:

- `HTTP_HOST` - Request Host header
- `HTTP_USER_AGENT` - User-Agent header
- `HTTP_REFERER` - Referer header
- `HTTP_ACCEPT` - Accept header
- `HTTP_COOKIE` - Cookie header
- `REQUEST_URI` - Request URI path
- `REQUEST_METHOD` - HTTP method (GET, POST, etc.)
- `QUERY_STRING` - Query string
- `REMOTE_ADDR` - Client IP address
- `SERVER_NAME` - Server hostname
- `SERVER_PORT` - Server port
- `HTTPS` - "on" if HTTPS, "off" otherwise
- `DOCUMENT_ROOT` - Document root path
- `REQUEST_FILENAME` - Requested file path

### Parser Improvements

The new parser supports:

- **Quoted strings:** `Header set X-Custom "value with spaces"`
- **Escape sequences:** `\"`, `\\`
- **Multi-line continuations:** Lines ending with `\`
- **Comments:** Lines starting with `#`
- **Flexible flag syntax:** Both `[R=301]` and `R=301` (backward compatible)

## Authentication & Authorization

### Digest Authentication

- [ ] **Digest Authentication** (.htdigest)
  - More secure than Basic Auth (passwords hashed with MD5)
  - Challenge-response mechanism
  - Files already loaded but not implemented

### Group-based Authorization

- [ ] **Group Management** (.htgroup)
  - User group definitions
  - Group-based access control
  - Files already loaded but not implemented

### Access Control Directives

- [ ] **Require Directive**
  - `Require valid-user` - any authenticated user
  - `Require user username1 username2` - specific users
  - `Require group groupname` - specific groups
  - `Require ip 192.168.1.0/24` - IP-based access
  - `Require host example.com` - hostname-based access
  - `Require all granted/denied` - allow/deny all

✅ **Auth Directives** - Parsing implemented (enforcement pending)

Supported directives:

```apache
AuthType Basic              # or Digest
AuthName "Restricted Area"
AuthUserFile /path/to/.htpasswd
AuthGroupFile /path/to/.htgroup
AuthDigestProvider file
Require valid-user
Require user admin moderator
Require group developers
Require ip 192.168.1.0/24
Require host example.com
Require all granted         # or denied
```

See the [Security Guide](./security.md#sec-001-auth-directives-are-parsed-but-not-enforced)
for the current state of `Require`/`AuthType` enforcement.

### IP-based Access Control (Legacy)

✅ **Order/Allow/Deny** (Apache 2.2 style) - Fully implemented and enforced

Supported syntax:

```apache
Order deny,allow            # or allow,deny or mutual-failure
Deny from all
Allow from 192.168.1.0/24
Allow from 10.0.0.5
Deny from badhost.example.com
Allow from env=LOCAL_ACCESS
```

**Common patterns:**

Deny all access:

```apache
Deny from all
```

Allow only specific IPs:

```apache
Order deny,allow
Deny from all
Allow from 192.168.1.0/24
Allow from 10.0.0.5
```

Deny specific IPs:

```apache
Order allow,deny
Allow from all
Deny from 203.0.113.0/24
```

**Note:** Access Control (Order/Allow/Deny) directives are fully enforced automatically. Auth directives (Require) are currently parsed but not automatically enforced. You can access the parsed configuration via `authConfig` property and implement custom enforcement logic in middleware.

## URL Rewriting & Redirection

### RewriteRule Features

✅ **Implemented Flags:**

- `[L]` - Last rule, stop processing
- `[R]` / `[R=301]` / `[R=302]` - Redirect with status code
- `[F]` - Forbidden (return 403)
- `[G]` - Gone (return 410)
- `[NC]` - No Case (case-insensitive matching)
- `[QSA]` - Query String Append
- `[QSD]` - Query String Discard
- `[NE]` - No Escape (don't escape special chars)

⏳ **Future Flags:**

- `[P]` - Proxy (reverse proxy)
- `[PT]` - Pass Through to next handler
- `[S=N]` - Skip next N rules
- `[E=VAR:value]` - Set environment variable
- `[CO=name:value:domain]` - Set cookie
- `[T=MIME-type]` - Force MIME type
- `[N]` - Next iteration (restart rule processing)
- `[C]` - Chain with next rule
- `[DPI]` - Discard Path Info
- `[H=handler]` - Force handler

### Advanced Rewriting

- [ ] **RewriteBase**
  - Set base URL for relative rewrites
  - Useful for subdirectory installations

- [ ] **RewriteMap**
  - External mapping files
  - Database lookups
  - Internal functions (toupper, tolower, escape, unescape)

### Redirect Directives

✅ **Implemented:**

- `Redirect [status] source target` - With numeric status code

⏳ **Future:**

- `RedirectPermanent` - permanent (301)
- `RedirectTemp` - explicit temporary (302)
- `RedirectMatch` - with regex pattern

## Error Handling

✅ **ErrorDocument** - External URL redirect implemented; local paths not yet served

```apache
# Supported today: redirects to an external URL when the status matches
ErrorDocument 404 https://example.com/errors/404.html
ErrorDocument 500 https://example.com/errors/500.html

# Parsed, but NOT served: the matching directive is stored, and Matchbox
# responds with a plain "Error 404: See /errors/404.html" text body instead
# of the file's contents.
ErrorDocument 403 /errors/forbidden.html
```

⏳ **Future Enhancements:**

- Serving local error page content (currently only a placeholder text response is returned)
- Error document variables
- Dynamic error messages

## Directory Control

### Directory Indexing

- [ ] **Options Directive for Indexes**
  - `Options +Indexes` - enable directory listing
  - `Options -Indexes` - disable directory listing
  - `Options +FollowSymLinks` - follow symbolic links
  - `Options +ExecCGI` - allow CGI execution
  - `Options +Includes` - enable Server Side Includes
  - `Options +MultiViews` - content negotiation
  - `Options All` / `Options None`

- [ ] **DirectoryIndex**
  - Define default files: `DirectoryIndex index.html index.cgi index.php`
  - Multiple files in priority order
  - Already partially implemented for .cgi files

- [ ] **IndexOptions / IndexIgnore**
  - Enhanced directory listings
  - Hide specific files

## MIME Types & Handlers

- [ ] **AddType** - Associate MIME types with extensions
- [ ] **AddHandler** - Associate handlers with extensions
- [ ] **ForceType** - Force MIME type for all files
- [ ] **DefaultType** - Default MIME type
- [ ] **AddDefaultCharset** - Default character encoding

## Performance & Caching

### Cache Control

- [ ] **ExpiresActive / ExpiresDefault / ExpiresByType**
  - Control browser caching with Expires headers

- [ ] **Header Directive for Caching**
  - `Header set Cache-Control "max-age=3600, public"`
  - `Header unset ETag`
  - `Header append Vary "Accept-Encoding"`

### Compression

- [ ] **Deflate/Gzip Configuration**
  - Automatic response compression
  - Filter by content type

## Security Headers

✅ **Header Directive** - Implemented

```apache
Header set X-Frame-Options "SAMEORIGIN"
Header set X-Content-Type-Options "nosniff"
Header set X-XSS-Protection "1; mode=block"
Header set Strict-Transport-Security "max-age=31536000"
Header set Content-Security-Policy "default-src 'self'"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Permissions-Policy "geolocation=(), microphone=()"
Header append Vary "Accept-Encoding"
Header unset X-Powered-By
```

### Helper Functions

```typescript
import { securityHeaders } from "@tknf/matchbox";

// Predefined security header configurations
const config = {
  headers: [
    securityHeaders.xFrameOptions("SAMEORIGIN"),
    securityHeaders.xContentTypeOptions(),
    securityHeaders.xssProtection(true),
    securityHeaders.hsts(31536000, true),
    securityHeaders.csp("default-src 'self'"),
    securityHeaders.referrerPolicy("strict-origin-when-cross-origin"),
    securityHeaders.permissionsPolicy("geolocation=(), microphone=()")
  ]
};
```

### CORS Headers

✅ **Fully Implemented** - Use Header directive or helper functions

**.htaccess syntax:**

```apache
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
Header set Access-Control-Allow-Credentials "true"
Header set Access-Control-Max-Age "3600"
Header set Access-Control-Expose-Headers "X-Custom-Header"
```

**TypeScript helper functions:**

```typescript
import { corsHeaders } from "@tknf/matchbox";

const config = {
  headers: [
    corsHeaders.allowOrigin("https://example.com"),
    corsHeaders.allowMethods(["GET", "POST", "PUT", "DELETE", "OPTIONS"]),
    corsHeaders.allowHeaders(["Content-Type", "Authorization"]),
    corsHeaders.allowCredentials(true),
    corsHeaders.maxAge(3600),
    corsHeaders.exposeHeaders(["X-Total-Count", "X-Page-Number"]),
  ]
};
```

## Request Filtering

- [ ] **LimitRequestBody** - Limit upload/request size
- [ ] **Limit Directive** - Restrict HTTP methods
- [ ] **TraceEnable** - Disable HTTP TRACE

## Environment Variables

- [ ] **SetEnv / UnsetEnv**
- [ ] **SetEnvIf / SetEnvIfNoCase**
- [ ] **BrowserMatch**

## Logging

- [ ] **CustomLog / LogFormat**
- [ ] **ErrorLog / LogLevel**

## Implementation Priority

### ✅ High Priority - COMPLETED (v0.3.0)

1. ✅ Basic Authentication (.htpasswd)
2. ✅ URL Rewriting (RewriteRule with comprehensive flags)
3. ✅ Redirects (Redirect directive)
4. ✅ RewriteCond - Conditional rewriting
5. ✅ ErrorDocument - Custom error pages
6. ✅ Security Headers (Header directive)
7. ✅ CORS Headers (Access-Control-\* with helpers)
8. ✅ Auth Directives parsing (AuthType, AuthName, Require)
9. ✅ Access Control enforcement (Order/Allow/Deny)

### Medium Priority (Future)

1. [ ] Auth Directives enforcement (Require user/group/ip/host)
2. [ ] Digest authentication (.htdigest) - verification
3. [ ] Group-based authorization (.htgroup) - enforcement
4. [ ] MIME type configuration
5. [ ] Caching headers (Expires, Cache-Control)
6. [ ] Request limits
7. [ ] Compression

### Low Priority (Nice to Have)

1. [ ] Directory indexing customization
2. [ ] Advanced logging
3. [ ] Environment variables
4. [ ] SSI support

### Not Applicable / Out of Scope

- Apache-specific server configuration (ServerTokens, HostnameLookups)
- Features that conflict with Node.js/Hono architecture
- Low-level Apache module features

## Usage Examples

### Basic Rewrite with Condition

```apache
# Redirect www to non-www
RewriteCond %{HTTP_HOST} ^www\.example\.com$
RewriteRule ^(.*)$ https://example.com/$1 [R=301,L]
```

### Multiple Conditions (AND logic)

```apache
# Block POST requests from specific user agent
RewriteCond %{REQUEST_METHOD} POST
RewriteCond %{HTTP_USER_AGENT} BadBot
RewriteRule .* - [F]
```

### Multiple Conditions (OR logic)

```apache
# Block multiple bad bots
RewriteCond %{HTTP_USER_AGENT} BadBot1 [OR]
RewriteCond %{HTTP_USER_AGENT} BadBot2
RewriteRule .* - [F]
```

### Query String Manipulation

```apache
# Append existing query string to redirect
RewriteRule ^old-api$ /new-api?migrated=true [QSA,R=302]

# Discard query string
RewriteRule ^clean$ /destination [QSD,R=302]
```

### Case-Insensitive Matching

```apache
RewriteRule ^about$ /about.cgi [NC,L]
# Matches: /about, /About, /ABOUT, /aBouT, etc.
```

### Security Setup

> **Note:** The `ErrorDocument` lines below use local paths for illustration,
> but local paths are only parsed, not served (see [Error Handling](#error-handling)) —
> use external URLs if you need `ErrorDocument` to actually redirect. The
> `AuthType`/`AuthName`/`AuthUserFile`/`Require` lines are parsed but **not
> enforced** by Matchbox (see [Security Guide](./security.md#sec-001-auth-directives-are-parsed-but-not-enforced));
> real Basic Auth enforcement comes from placing a `.htpasswd` file in the
> directory, as described in [Authentication & Authorization](#authentication--authorization).

```apache
# Comprehensive security headers
Header set X-Frame-Options "SAMEORIGIN"
Header set X-Content-Type-Options "nosniff"
Header set X-XSS-Protection "1; mode=block"
Header set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Permissions-Policy "geolocation=(), microphone=(), camera=()"

# CORS for API endpoints
Header set Access-Control-Allow-Origin "https://app.example.com"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
Header set Access-Control-Allow-Credentials "true"

# Custom error pages (local paths not served; use external URLs to redirect)
ErrorDocument 404 /errors/404.html
ErrorDocument 403 /errors/403.html
ErrorDocument 500 /errors/500.html

# Parsed but not enforced (see note above) — place a real .htpasswd file
# under the protected directory for actual Basic Auth enforcement
AuthType Basic
AuthName "Restricted Area"
AuthUserFile /path/to/.htpasswd
Require valid-user
```

### Access Control Examples

Deny all access (maintenance mode):

```apache
Deny from all
```

Allow only from specific IP ranges:

```apache
Order deny,allow
Deny from all
Allow from 192.168.1.0/24
Allow from 10.0.0.5
```

Block specific bad actors:

```apache
Order allow,deny
Allow from all
Deny from 203.0.113.0/24
Deny from malicious.example.com
```

Allow local development only:

```apache
Order deny,allow
Deny from all
Allow from 127.0.0.1
Allow from ::1
Allow from localhost
```

## Notes

- ✅ Implementation in v0.3.0 focuses on High Priority features
- ✅ Modular architecture allows incremental feature additions
- ✅ Type-safe configuration with comprehensive TypeScript definitions
- ✅ Backward compatible with v0.2.x .htaccess files
- Security features are prioritized for production use
- Performance features (caching, compression) to be added incrementally
