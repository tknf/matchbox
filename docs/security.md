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

### 2. Protection Against Direct Access to Configuration Files

The framework automatically blocks access to sensitive configuration files:

- `.htaccess`
- `.htpasswd`
- `.htdigest`
- `.htgroup`

Any direct HTTP request to these files returns a 403 Forbidden response.

### 3. Basic Authentication Support

Built-in support for HTTP Basic Authentication through `.htpasswd` files:

- Credentials are verified on each request
- Realm-based authentication
- Directory-level protection

### 4. Input Handling

- **File Upload Separation**: Files uploaded via multipart forms are automatically separated from regular POST data into `$_FILES`
- **Query Parameter Parsing**: GET and POST parameters are parsed and available through type-safe objects
- **Cookie Parsing**: Cookies are parsed and available through `$_COOKIE`

## Security Best Practices

### 1. Session Management

- Use `sessionCookie.secure: true` in production
- Set appropriate `sessionCookie.maxAge` to limit session lifetime
- Consider using `sessionCookie.sameSite: "Strict"` for high-security applications

### 2. Error Handling

- Error messages in production should not expose sensitive information
- Stack traces are shown in error pages by default - consider implementing custom error handlers in production
- Use the custom logger option to control logging behavior

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

## Known Limitations and Future Improvements

### Current Limitations

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

See `docs/todo.md` for planned security-related features.

## Security Reporting

If you discover a security vulnerability, please report it to the project maintainers. Do not open public issues for security vulnerabilities.

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Hono Security Best Practices](https://hono.dev/docs/guides/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
