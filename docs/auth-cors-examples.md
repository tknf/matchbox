# Authentication and CORS Examples

This guide demonstrates how to use the newly implemented Authentication directives and CORS headers in Matchbox.

## Authentication Directives

### Basic Authentication with AuthType and Require

**.htaccess:**

```apache
AuthType Basic
AuthName "Restricted Area"
AuthUserFile /path/to/.htpasswd
Require valid-user
```

This configuration:

- Sets authentication type to Basic
- Displays "Restricted Area" as the realm name in the browser prompt
- Points to the .htpasswd file for user credentials
- Requires any valid authenticated user

### Require Specific Users

**.htaccess:**

```apache
AuthType Basic
AuthName "Admin Panel"
AuthUserFile /path/to/.htpasswd
Require user admin moderator
```

Only users `admin` or `moderator` can access this directory.

### Require Group-based Access

**.htaccess:**

```apache
AuthType Basic
AuthName "Team Area"
AuthUserFile /path/to/.htpasswd
AuthGroupFile /path/to/.htgroup
Require group developers
```

Only users in the `developers` group can access.

**.htgroup example:**

```
developers: alice bob charlie
admins: admin superuser
```

### Require IP-based Access

**.htaccess:**

```apache
# Allow access from specific IP addresses
Require ip 192.168.1.0/24
Require ip 10.0.0.1

# Or combined with authentication
AuthType Basic
AuthName "Protected"
AuthUserFile /path/to/.htpasswd
Require valid-user
Require ip 192.168.1.0/24
```

### Require All Granted/Denied

**.htaccess:**

```apache
# Deny access to everyone
Require all denied

# Or allow everyone (removes authentication)
Require all granted
```

### Digest Authentication

**.htaccess:**

```apache
AuthType Digest
AuthName "Secure Zone"
AuthDigestProvider file
AuthUserFile /path/to/.htdigest
Require valid-user
```

Note: Digest authentication is more secure than Basic as passwords are hashed.

## CORS (Cross-Origin Resource Sharing) Headers

### Using .htaccess Directives

**.htaccess:**

```apache
# Allow all origins
Header set Access-Control-Allow-Origin "*"

# Allow specific origin
Header set Access-Control-Allow-Origin "https://example.com"

# Allow specific methods
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"

# Allow specific headers
Header set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"

# Allow credentials
Header set Access-Control-Allow-Credentials "true"

# Set preflight cache duration (1 hour)
Header set Access-Control-Max-Age "3600"

# Expose custom headers to the client
Header set Access-Control-Expose-Headers "X-Custom-Header, X-Total-Count"
```

### Using TypeScript Helpers

```typescript
import { createCgiWithPages, corsHeaders, securityHeaders } from "@tknf/matchbox";

const htaccessConfig = {
  "/api": {
    rewriteRules: [],
    redirects: [],
    errorDocuments: [],
    headers: [
      // CORS headers for API endpoints
      corsHeaders.allowOrigin("https://app.example.com"),
      corsHeaders.allowMethods(["GET", "POST", "PUT", "DELETE", "OPTIONS"]),
      corsHeaders.allowHeaders(["Content-Type", "Authorization"]),
      corsHeaders.allowCredentials(true),
      corsHeaders.maxAge(3600),
      corsHeaders.exposeHeaders(["X-Total-Count", "X-Page-Number"]),
    ],
  },
  "/": {
    rewriteRules: [],
    redirects: [],
    errorDocuments: [],
    headers: [
      // Security headers for all pages
      securityHeaders.xFrameOptions("SAMEORIGIN"),
      securityHeaders.xContentTypeOptions(),
      securityHeaders.hsts(31536000, true),
      securityHeaders.csp("default-src 'self'; script-src 'self' 'unsafe-inline'"),
    ],
  },
};

const app = createCgiWithPages(pages, {}, authMap, htaccessConfig);
```

### Handling CORS Preflight Requests

For APIs that receive CORS preflight requests (OPTIONS method), you may need to handle them:

**.htaccess:**

```apache
# Handle OPTIONS requests for CORS preflight
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=204,L]

Header always set Access-Control-Allow-Origin "*"
Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header always set Access-Control-Allow-Headers "Content-Type, Authorization"
Header always set Access-Control-Max-Age "3600"
```

Or in your CGI handler:

```typescript
// api.cgi.tsx
export default function (ctx: CgiContext) {
  // Handle CORS preflight
  if (ctx.req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  // Your API logic here
  return { data: "Hello API" };
}
```

## Combined Example: Secure API with CORS

This example shows a complete configuration for a secure API endpoint with CORS support:

**.htaccess:**

```apache
# Security headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "DENY"

# CORS configuration
Header set Access-Control-Allow-Origin "https://app.example.com"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
Header set Access-Control-Allow-Credentials "true"
Header set Access-Control-Max-Age "3600"

# Authentication (except for preflight)
RewriteCond %{REQUEST_METHOD} !OPTIONS
AuthType Basic
AuthName "API Access"
AuthUserFile /path/to/.htpasswd
Require valid-user

# Handle preflight requests
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ $1 [R=204,L]
```

Or using TypeScript configuration:

```typescript
import { parseHtaccess } from "@tknf/matchbox";

const apiConfig = parseHtaccess(`
# Security headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "DENY"

# CORS
Header set Access-Control-Allow-Origin "https://app.example.com"
Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type, Authorization"
Header set Access-Control-Allow-Credentials "true"
Header set Access-Control-Max-Age "3600"

# Authentication
AuthType Basic
AuthName "API Access"
AuthUserFile /path/to/.htpasswd
Require valid-user
`);
```

## Parsed Configuration Structure

When you use authentication directives, they are parsed into the `authConfig` property:

```typescript
{
  authConfig: {
    authType: "Basic",
    authName: "Restricted Area",
    authUserFile: "/path/to/.htpasswd",
    authGroupFile: "/path/to/.htgroup",  // optional
    authDigestProvider: "file",           // for Digest auth
    require: [
      { type: "valid-user" },
      { type: "user", value: ["admin", "moderator"] },
      { type: "group", value: ["developers"] },
      { type: "ip", value: ["192.168.1.0/24"] },
      { type: "host", value: ["example.com"] },
      { type: "all", granted: true }
    ]
  }
}
```

## Important Notes

### Current Implementation Status

✅ **Fully Implemented:**

- Parsing of all Auth directives (AuthType, AuthName, AuthUserFile, AuthGroupFile, Require)
- CORS header helpers (corsHeaders)
- Header directive with set/append/unset actions
- Access Control enforcement (Order/Allow/Deny - Apache 2.2 style)
- IP-based access control with CIDR support
- Hostname-based access control with wildcards
- Environment variable-based access control

⏳ **Planned for Future:**

- Automatic enforcement of Require directives (currently parsed but not enforced)
- Digest authentication verification
- Group-based access control enforcement (Require group)

### Access Control Enforcement

Access Control (Order/Allow/Deny) directives are **automatically enforced** - no additional configuration needed! Simply add them to your .htaccess file:

```apache
# Deny all access
Deny from all

# Or allow only specific IPs
Order deny,allow
Deny from all
Allow from 192.168.1.0/24
Allow from 10.0.0.5
```

The middleware automatically:

- ✅ Checks client IP addresses (with CIDR support)
- ✅ Matches hostnames (with wildcard support like \*.example.com)
- ✅ Checks environment variables
- ✅ Applies Order logic (allow,deny / deny,allow / mutual-failure)
- ✅ Returns 403 Forbidden when access is denied

### Manual Require Directive Enforcement

Until automatic enforcement of Require directives is implemented, you can manually check `authConfig` in your middleware:

```typescript
import { createCgiWithPages } from "@tknf/matchbox";

const options = {
  middleware: [
    async (c, next) => {
      // Get the htaccess config for this path
      const path = c.req.path;
      const config = htaccessConfig[path] || htaccessConfig["/"];

      if (config?.authConfig?.require) {
        // Implement your custom require logic here
        for (const req of config.authConfig.require) {
          if (req.type === "ip") {
            const clientIP = c.req.header("x-forwarded-for") || c.env.REMOTE_ADDR;
            // Check if clientIP matches req.value
          }
        }
      }

      await next();
    }
  ]
};

const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, options);
```

## Testing Your Configuration

You can test the parsed configuration:

```typescript
import { parseHtaccess } from "@tknf/matchbox";

const config = parseHtaccess(`
AuthType Basic
AuthName "Test"
Require user admin
Header set Access-Control-Allow-Origin "*"
`);

console.log(config);
// {
//   rewriteRules: [],
//   redirects: [],
//   errorDocuments: [],
//   headers: [{ action: "set", name: "Access-Control-Allow-Origin", value: "*" }],
//   authConfig: {
//     authType: "Basic",
//     authName: "Test",
//     require: [{ type: "user", value: ["admin"] }]
//   }
// }
```

## Security Best Practices

1. **Always use HTTPS** when using authentication
2. **Limit CORS origins** to specific trusted domains instead of "\*"
3. **Use credentials carefully** - only set `Access-Control-Allow-Credentials: true` when necessary
4. **Combine authentication with IP restrictions** for sensitive endpoints
5. **Use security headers** alongside CORS for defense in depth
6. **Validate and sanitize** all user input regardless of authentication

## Related Documentation

- [Apache .htaccess Features Reference](./htaccess-features.md)
- [Security Headers Guide](./htaccess-features.md#security-headers)
- [Migration Guide](./htaccess-features.md#migration-from-v02x-to-v03)
