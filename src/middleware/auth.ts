import type { Context, Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

/**
 * Constant-time string comparison to reduce the risk of a timing attack
 * revealing password contents through response latency. Length is compared
 * first (mismatched lengths return immediately without walking the bytes),
 * then every byte is compared regardless of where the first mismatch occurs.
 */
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Parse .htpasswd content and create Basic Auth middleware.
 *
 * The credential map and the `hono/basic-auth` handler are both built once,
 * at middleware-creation time, rather than on every request.
 */
function createBasicAuthMiddleware(
	htpasswdContent: string,
	realm = "Restricted Area",
): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
	const credentials = new Map<string, string>();
	for (const rawLine of htpasswdContent.split("\n")) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		const [username, password] = line.split(":");
		if (username === undefined || password === undefined) continue;
		credentials.set(username, password);
	}

	if (credentials.size === 0) {
		// No valid credentials, skip auth
		return async (_c, next) => {
			await next();
		};
	}

	const handler = basicAuth({
		verifyUser: (u, p) => {
			const storedPassword = credentials.get(u);
			return storedPassword !== undefined && timingSafeEqual(storedPassword, p);
		},
		realm,
	});

	return async (c, next) => handler(c, next);
}

/**
 * Apply Basic Auth middleware to Hono app for each directory
 */
export function applyBasicAuth(app: Hono, authMap: Record<string, string>): void {
	Object.entries(authMap).forEach(([dir, content]) => {
		const authPath = dir === "/" ? "*" : `${dir.replace(/\/$/, "")}/*`;
		app.use(authPath, createBasicAuthMiddleware(content));
	});
}
