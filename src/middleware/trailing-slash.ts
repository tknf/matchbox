import type { Context, Hono } from "hono";

/**
 * Apply trailing slash middleware to enforce trailing slash on URLs
 */
export function applyTrailingSlashMiddleware(app: Hono): void {
	app.use("*", async (c: Context, next: () => Promise<void>) => {
		const path = c.req.path;
		if (!path.endsWith("/") && !path.includes(".")) {
			return c.redirect(`${path}/`, 301);
		}
		await next();
	});
}
