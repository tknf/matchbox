# Session Management Example

This example demonstrates session management in Matchbox.

## Features

- **User Authentication**: Login and logout with session persistence
- **Profile Page**: Display session data
- **Shopping Cart**: Session-based shopping cart
- **Visit Counter**: Track page visits using sessions

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

## Examples

### Login System

- `/login.cgi` - Login page (username: "demo", password: "password")
- `/profile.cgi` - User profile (requires login)
- `/logout.cgi` - Logout endpoint

### Shopping Cart

- `/cart.cgi` - Session-based shopping cart
  - Add items to cart
  - Remove items from cart
  - Clear cart

### Visit Counter

- `/counter.cgi` - Page visit counter using sessions

## How Sessions Work

Matchbox uses the built-in session API to manage user state across requests:

```typescript
// Set session data
await session.set("key", value);

// Get session data
const value = await session.get("key");

// Delete session data
await session.delete("key");
```

Sessions are automatically managed and persisted across requests, making it easy to build stateful applications.

## Testing

1. Visit the login page and log in with demo credentials
2. Navigate to your profile to see session data
3. Try adding items to the shopping cart
4. Refresh the counter page to see visits increase
5. Logout and verify session is cleared
