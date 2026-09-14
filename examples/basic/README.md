# Matchbox Example Project

This is a basic example project demonstrating how to use the Matchbox framework with Vite.

## About Matchbox

Matchbox is a simple web server framework built on top of Hono that provides a CGI-style development experience with modern tooling. It allows you to create web pages using `.cgi.tsx` or `.cgi.jsx` files and supports features like:

- **CGI-style routing**: Pages are automatically routed based on file structure
- **Basic Authentication**: Support for `.htpasswd` files
- **URL Rewriting**: Support for `.htaccess` rewrite rules
- **Session Management**: Built-in session handling
- **File Uploads**: Easy handling of file uploads

## Features in This Example

This basic example includes:

- `/` or `/index.cgi` - Index page with all example links
- `/hello.cgi` - Simple hello world page
- `/info.cgi` - Display CGI environment information
- `/form.cgi` - Form handling (POST requests)
- `/counter.cgi` - Query parameter handling with counter
- `/json-api.cgi` - JSON API response example
- `/redirect-example.cgi` - Redirect example

## Prerequisites

- The Node.js version in the repository root `.node-version`
- pnpm (the version declared in the root `package.json`)

## Installation

Install dependencies and build the library from the repository root:

```bash
pnpm install
pnpm build
cd examples/basic
```

This example shares the root pnpm workspace, lockfile, and Vite+ toolchain.

## Development

To start the development server:

```bash
pnpm dev
```

The development server will start and you can access your application at `http://localhost:5173` (or the port shown in the terminal).

## Project Structure

```
example/
├── public/              # Public directory for your pages
│   └── .gitkeep
├── server.ts            # Main server entry point
├── vite.config.ts       # Vite configuration with Matchbox plugin
├── package.json
└── README.md           # This file
```

## Creating Pages

Create `.cgi.tsx` or `.cgi.jsx` files in the `public/` directory:

### Example: Hello World Page

Create `public/hello.cgi.tsx`:

```tsx
import type { CgiContext } from 'matchbox';

export default function({ $_GET, $_POST, config, c }: CgiContext) {
  return (
    <html>
      <head>
        <title>Hello World</title>
      </head>
      <body>
        <h1>Hello from Matchbox!</h1>
        <p>This is a CGI-style page built with modern tooling.</p>
      </body>
    </html>
  );
}
```

Access this page at: `http://localhost:5173/hello.cgi`

### Example: Index Page

Create `public/index.cgi.tsx`:

```tsx
import type { CgiContext } from 'matchbox';

export default function({ $_SERVER }: CgiContext) {
  return (
    <html>
      <head>
        <title>Welcome to Matchbox</title>
      </head>
      <body>
        <h1>Welcome!</h1>
        <p>Request Method: {$_SERVER.REQUEST_METHOD}</p>
        <p>Path: {$_SERVER.PATH_INFO}</p>
      </body>
    </html>
  );
}
```

Access this page at: `http://localhost:5173/` or `http://localhost:5173/index.cgi`

## CGI Context

Each page function receives a `CgiContext` object with the following properties:

- `$_GET`: Query string parameters
- `$_POST`: POST form data
- `$_FILES`: Uploaded files
- `$_REQUEST`: Combined GET, POST, and COOKIE data
- `$_SESSION`: Session data (automatically persisted)
- `$_COOKIE`: Cookie data
- `$_ENV`: Environment variables
- `$_SERVER`: Server information (REQUEST_METHOD, REQUEST_URI, etc.)
- `config`: Site configuration object
- `c`: Hono context object
- `header(name, value)`: Set response header
- `status(code)`: Set response status code
- `redirect(url, status?)`: Redirect to another URL
- `cgiinfo()`: Display CGI information page

## Authentication

To add basic authentication to a directory, create a `.htpasswd` file:

```
# public/admin/.htpasswd
admin:password123
user:secret456
```

All pages under `/admin/` will require authentication.

## URL Rewriting

Create `.htaccess` files for URL rewriting:

```
# public/.htaccess
RewriteRule ^old-page$ /new-page R=301
Redirect 301 /legacy /modern
```

## Building the Library

Run `pnpm build` from the repository root to rebuild Matchbox in `dist/`.
This example provides a development server; it does not define a production
deployment target.

## Configuration

### Custom Public Directory

You can change the public directory in `vite.config.ts`:

```typescript
import { MatchboxPlugin } from 'matchbox/plugin';

export default defineConfig({
  plugins: [
    MatchboxPlugin({
      publicDir: 'src/pages', // Custom directory
    }),
  ],
});
```

Server entryは `createCgi()` をそのまま export すればOKです。
Note: page discovery currently assumes `/public`. Custom page roots will be supported later.

### Site Configuration

Pass configuration to all pages:

```typescript
import { MatchboxPlugin } from 'matchbox/plugin';

export default defineConfig({
  plugins: [
    MatchboxPlugin({
      config: {
        siteName: 'My Site',
        apiKey: process.env.API_KEY,
      },
    }),
  ],
});
```

Server entryは `createCgi()` をそのまま export すればOKです。

Access configuration in your pages via `config` property in CgiContext.

## Learn More

- [Matchbox Documentation](https://github.com/tknf/matchbox)
- [Hono Documentation](https://hono.dev/)
- [Vite Documentation](https://vitejs.dev/)

## License

This example project is provided as-is for demonstration purposes.
