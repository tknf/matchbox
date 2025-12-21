# Matchbox Examples

This directory contains multiple examples demonstrating various features and use cases of the Matchbox framework.

## Available Examples

### 1. Basic Example ([examples/basic](./basic))

A fundamental example showcasing core Matchbox features:

- Simple Hello World page
- CGI environment information
- Form handling (POST requests)
- Query parameter handling
- JSON API responses
- Redirects

**Best for**: Getting started with Matchbox, learning basic concepts

### 2. Middleware Example ([examples/middleware](./middleware))

Demonstrates middleware patterns and request/response interceptors:

- Request logging middleware
- Custom header middleware
- Route-specific authentication
- Protected routes with Bearer token auth

**Best for**: Understanding middleware patterns, implementing authentication

### 3. Session Management Example ([examples/session](./session))

Shows how to manage user sessions and state:

- User login/logout
- Session persistence
- Shopping cart with sessions
- Visit counter

**Best for**: Building stateful applications, user authentication systems

### 4. File Upload Example ([examples/file-upload](./file-upload))

Demonstrates file upload handling:

- Single file upload
- Multiple file upload
- Image upload with preview
- File metadata display

**Best for**: Building applications that handle file uploads

### 5. HTAccess + Basic Auth Example ([examples/htaccess-auth](./htaccess-auth))

Shows how `.htaccess` rewrite/redirect rules and `.htpasswd` authentication work:

- Redirect and rewrite rules
- Basic auth for `/admin/*`
- Protected pages via `.htpasswd`

**Best for**: Using Apache-style access control and redirects in Matchbox

## Getting Started

Each example is a standalone project. To run an example:

1. Navigate to the example directory:
   ```bash
   cd examples/basic  # or middleware, session, file-upload
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open your browser to `http://localhost:5173`

## Project Structure

Each example follows the same structure:

```
example-name/
├── public/           # CGI pages (.cgi.tsx files)
├── server.ts         # Server configuration
├── vite.config.ts    # Vite configuration
├── package.json      # Dependencies
├── tsconfig.json     # TypeScript configuration
└── README.md         # Example-specific documentation
```

## Learning Path

We recommend exploring the examples in this order:

1. **Basic** - Learn fundamental concepts and routing
2. **Middleware** - Understand request/response processing
3. **Session** - Build stateful applications
4. **File Upload** - Handle file uploads
5. **HTAccess + Basic Auth** - Use `.htaccess` and `.htpasswd`

## About Matchbox

Matchbox is a CGI-style web framework built on top of Hono that brings the simplicity of traditional CGI programming to the modern web. Key features include:

- **File-based routing**: Pages map directly to files
- **CGI-style development**: Familiar patterns for CGI developers
- **Modern tooling**: Built with Vite and TypeScript
- **JSX/TSX support**: Write pages using React-like syntax
- **Session management**: Built-in session handling
- **Middleware support**: Extensible with Hono middleware

## Contributing

Found an issue or want to add a new example? Contributions are welcome! Please check the main repository for contribution guidelines.

## License

See the main repository's LICENSE file.
