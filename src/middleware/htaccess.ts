import type { Hono } from "hono";
import { createRewriteMiddleware } from "../htaccess/rewrite.js";
import { createHeaderMiddleware } from "../htaccess/headers.js";
import { createErrorDocumentMiddleware } from "../htaccess/error-document.js";
import { createAccessControlMiddleware } from "../htaccess/access-control.js";
import type { HtaccessConfig } from "../htaccess/types.js";

/**
 * Apply htaccess middleware to Hono app in the correct order
 */
export function applyHtaccessMiddleware(app: Hono, htaccessConfig: HtaccessConfig): void {
	// 1. Headers Middleware (early to set security headers)
	Object.entries(htaccessConfig).forEach(([dir, config]) => {
		if (config.headers.length === 0) return;
		const basePath = dir === "/" ? "" : dir.replace(/\/$/, "");
		app.use(`${basePath}/*`, createHeaderMiddleware(config.headers));
	});

	// 2. Rewrite / Redirect Middleware
	Object.entries(htaccessConfig).forEach(([dir, config]) => {
		const allRules = [
			...config.rewriteRules,
			...config.redirects.map((r) => ({
				type: "rewrite" as const,
				pattern: `^${r.source}$`,
				target: r.target,
				flags: { redirect: r.code },
				conditions: [],
			})),
		];
		if (allRules.length === 0) return;
		const basePath = dir === "/" ? "" : dir.replace(/\/$/, "");
		app.use(`${basePath}/*`, createRewriteMiddleware(allRules, basePath));
	});

	// 2.5. Access Control Middleware (Order/Allow/Deny)
	Object.entries(htaccessConfig).forEach(([dir, config]) => {
		if (!config.accessControl) return;
		const basePath = dir === "/" ? "" : dir.replace(/\/$/, "");
		app.use(`${basePath}/*`, createAccessControlMiddleware(config.accessControl));
	});

	// Note: Basic Auth is applied separately
	// Error Document Middleware is applied last (after page routing)
}

/**
 * Apply error document middleware (must be applied last)
 */
export function applyErrorDocumentMiddleware(app: Hono, htaccessConfig: HtaccessConfig): void {
	Object.entries(htaccessConfig).forEach(([dir, config]) => {
		if (config.errorDocuments.length === 0) return;
		const basePath = dir === "/" ? "" : dir.replace(/\/$/, "");
		app.use(`${basePath}/*`, createErrorDocumentMiddleware(config.errorDocuments, basePath));
	});
}
