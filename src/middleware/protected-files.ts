import type { Context, Hono } from "hono";

/**
 * List of protected files that should not be accessible
 */
const PROTECTED_FILES = [".htaccess", ".htpasswd", ".htdigest", ".htgroup"];

/**
 * Apply protected files middleware to prevent access to sensitive configuration files
 */
export function applyProtectedFilesMiddleware(app: Hono): void {
	app.use("*", async (c: Context, next: () => Promise<void>) => {
		const path = c.req.path;
		const lastSegment = path.slice(path.lastIndexOf("/") + 1);

		if (PROTECTED_FILES.some((file) => lastSegment === file)) {
			return c.text("Forbidden", 403);
		}

		await next();
	});
}
