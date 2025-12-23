import type { Context, Hono } from "hono";
import { basicAuth } from "hono/basic-auth";

/**
 * Parse .htpasswd content and create Basic Auth middleware
 */
function createBasicAuthMiddleware(
	htpasswdContent: string,
	realm = "Restricted Area",
): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
	const credentials = htpasswdContent
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"))
		.map((line) => {
			const [username, password] = line.split(":");
			return { username, password };
		});

	if (credentials.length === 0) {
		// No valid credentials, skip auth
		return async (_c, next) => {
			await next();
		};
	}

	return async (c, next) => {
		const handler = basicAuth({
			verifyUser: (u, p) => credentials.some((cred) => cred.username === u && cred.password === p),
			realm,
		});
		return handler(c, next);
	};
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
