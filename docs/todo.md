# TODO List

- [x] Runtime Error: In virtual module, all globs must start with "/"
- [x] Add tests for different publicDir values in virtual module generation
- [x] Create example project README with setup instructions
- [x] Runtime Error: `Failed to parse source for import analysis because the content contains invalid JS syntax. If you are using JSX, make sure to name the file with the .jsx or .tsx extension.` in not found.
- [x] Runtime Error: `In virtual modules, all globs must start with '/'` if module in public directory.
- [x] Create options for `createCgi` to customize session cookie name, path, trailing slash, etc.
- [x] Prevent access to `.htaccess` and `.htpasswd` during development.
- [x] Middleware support for custom headers, logging, etc.
- [x] Implement functionality to create and inject mods.
- [x] Implement functions of `.htdigest` and `.htgroup` files.

## Security Improvements Completed
- [x] Added session cookie configuration options (secure, sameSite, maxAge, domain, path)
- [x] Implemented protection against direct access to configuration files (.htaccess, .htpasswd, .htdigest, .htgroup)
- [x] Added custom middleware support for additional security layers
- [x] Implemented custom logger support
- [x] Created comprehensive security documentation

## Future Enhancements
- [ ] Implement digest authentication using .htdigest files
- [ ] Implement group-based authorization using .htgroup files
- [ ] Add built-in CSRF token support
- [ ] Add rate limiting middleware
- [ ] Add Content Security Policy helpers

