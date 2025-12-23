import type { Context } from "hono";
import type { ErrorDocumentConfig } from "./types.js";

/**
 * Create middleware for error documents
 */
export function createErrorDocumentMiddleware(
	errorDocs: ErrorDocumentConfig[],
	_basePath: string,
): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
	return async (c, next) => {
		await next();

		// Check if response is an error status
		const status = c.res.status;
		if (status < 400) return;

		// Find matching error document
		const errorDoc = errorDocs.find((doc) => doc.statusCode === status);
		if (!errorDoc) return;

		// Check if target is external URL
		if (errorDoc.target.startsWith("http://") || errorDoc.target.startsWith("https://")) {
			return c.redirect(errorDoc.target);
		}

		// For local paths, return a simple message
		// In a full implementation, this would load the error page content
		return c.text(`Error ${status}: See ${errorDoc.target}`, status as any);
	};
}
