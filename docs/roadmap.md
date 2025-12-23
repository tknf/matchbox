# Roadmap

This document outlines planned features and improvements for Matchbox.

## Planned Features

### Enhanced Authentication

- [ ] **Digest Authentication** - Implement full MD5-based digest auth using `.htdigest` files
- [ ] **Group-based Authorization** - Enforce group access control using `.htgroup` files
- [ ] **Require Directive Enforcement** - Automatic enforcement of `Require` directives
  - `Require valid-user`
  - `Require user username1 username2`
  - `Require group groupname`
  - `Require ip 192.168.1.0/24`
  - `Require host example.com`
  - `Require all granted/denied`

### Advanced Rewriting

- [ ] **RewriteBase** - Set base URL for relative rewrites
- [ ] **RewriteMap** - External mapping files and database lookups
- [ ] **Additional RewriteRule Flags**
  - `[P]` - Proxy (reverse proxy)
  - `[PT]` - Pass Through to next handler
  - `[S=N]` - Skip next N rules
  - `[E=VAR:value]` - Set environment variable
  - `[CO=name:value:domain]` - Set cookie
  - `[T=MIME-type]` - Force MIME type
  - `[N]` - Next iteration
  - `[C]` - Chain with next rule

### Directory Features

- [ ] **Options Directive**
  - `Options +Indexes` / `Options -Indexes` - Enable/disable directory listing
  - `Options +FollowSymLinks` - Follow symbolic links
  - `Options +ExecCGI` - Allow CGI execution
  - `Options +Includes` - Enable Server Side Includes
- [ ] **DirectoryIndex** - Define default files (currently hardcoded to index.cgi)
- [ ] **IndexOptions / IndexIgnore** - Enhanced directory listings

### MIME Types & Handlers

- [ ] **AddType** - Associate MIME types with extensions
- [ ] **AddHandler** - Associate handlers with extensions
- [ ] **ForceType** - Force MIME type for all files
- [ ] **DefaultType** - Default MIME type
- [ ] **AddDefaultCharset** - Default character encoding

### CORS Enhancements

- [ ] **CORS Helper Functions** - Easy CORS configuration
  - `corsHeaders.allowOrigin(origin)`
  - `corsHeaders.allowMethods(methods)`
  - `corsHeaders.allowHeaders(headers)`
  - `corsHeaders.allowCredentials(bool)`
  - `corsHeaders.maxAge(seconds)`
  - `corsHeaders.exposeHeaders(headers)`
- [ ] **Preflight Request Handling** - Automatic OPTIONS handling for CORS

### Environment Variables

- [ ] **SetEnv / UnsetEnv** - Set/unset environment variables in .htaccess
- [ ] **SetEnvIf / SetEnvIfNoCase** - Conditional environment variable setting
- [ ] **BrowserMatch** - Set variables based on user agent

### Logging

- [ ] **CustomLog / LogFormat** - Access logging configuration
- [ ] **ErrorLog / LogLevel** - Error logging configuration

## Contributing

Have ideas for features? Please:

1. Check existing [GitHub Issues](https://github.com/tknf-labs/matchbox/issues)
2. Open a new issue with the `enhancement` label
3. Join discussions on planned features
4. Submit pull requests for implementation

## Priority Levels

Features are prioritized based on:

- **High Priority** - Core functionality, security, Apache compatibility
- **Medium Priority** - Common use cases, developer convenience
- **Low Priority** - Edge cases, rarely used features

## Feedback

Your feedback shapes the roadmap! Please share:

- Feature requests
- Use cases
- Pain points
- Success stories

Open an issue or discussion on GitHub to contribute to the roadmap.
