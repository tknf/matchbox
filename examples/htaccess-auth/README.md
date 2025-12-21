# HTAccess + Basic Auth Example

This example demonstrates how Matchbox loads `.htaccess` and `.htpasswd` files
from the `public/` directory.

## Features

- **Redirect rules** with `.htaccess`
- **Basic authentication** with `.htpasswd`
- Protected routes under `/admin/*`

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open your browser and navigate to `http://localhost:5173/`

## Redirect Rules

The file `public/.htaccess` defines two rules:

- `Redirect 301 /legacy /new.cgi`
- `RewriteRule ^/account$ /admin/account.cgi R=302`

Visit `/legacy` or `/account` to see the redirect behavior.

## Basic Authentication

The file `public/admin/.htpasswd` protects the `/admin` directory.

Credentials for this example:

- Username: `admin`
- Password: `secret`

Try accessing these pages:

- `/admin/secret.cgi`
- `/admin/account.cgi`
