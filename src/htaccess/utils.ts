import type { Context } from "hono";
import type { RewriteCondition, RewriteFlags, RewriteResult, VariableContext } from "./types.js";

/**
 * Build variable context from Hono context
 */
export function buildVariableContext(c: Context): VariableContext {
	const url = new URL(c.req.url);

	return {
		HTTP_HOST: c.req.header("host") || "",
		HTTP_USER_AGENT: c.req.header("user-agent") || "",
		REQUEST_URI: c.req.path,
		QUERY_STRING: url.search.slice(1),
		HTTPS: url.protocol === "https:" ? "on" : "off",
		REMOTE_ADDR: c.req.header("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1",
		REQUEST_METHOD: c.req.method,
		HTTP_REFERER: c.req.header("referer") || "",
		HTTP_ACCEPT: c.req.header("accept") || "",
		HTTP_COOKIE: c.req.header("cookie") || "",
		SERVER_NAME: c.req.header("host")?.split(":")[0] || "localhost",
		SERVER_PORT: url.port || (url.protocol === "https:" ? "443" : "80"),
		DOCUMENT_ROOT: "",
		REQUEST_FILENAME: c.req.path,
	};
}

/**
 * Expand variables like %{HTTP_HOST} in test strings
 */
export function expandVariables(testString: string, context: VariableContext): string {
	return testString.replace(/%\{([^}]+)\}/g, (match, varName) => {
		const value = context[varName as keyof VariableContext];
		return value !== undefined ? String(value) : match;
	});
}

/**
 * Test a single RewriteCond
 */
export function testCondition(condition: RewriteCondition, context: VariableContext): boolean {
	const testValue = expandVariables(condition.testString, context);
	const pattern = new RegExp(condition.pattern, condition.flags.noCase ? "i" : "");
	return pattern.test(testValue);
}

/**
 * Apply rewrite flags to determine result
 */
export function applyRewriteFlags(
	target: string,
	flags: RewriteFlags,
	context: Context,
): RewriteResult {
	// [F] - Forbidden
	if (flags.forbidden) {
		return { type: "forbidden" };
	}

	// [G] - Gone
	if (flags.gone) {
		return { type: "gone" };
	}

	// [R] or [R=###] - Redirect
	if (flags.redirect) {
		let finalTarget = target;

		// [QSA] - Query String Append
		if (flags.qsAppend) {
			const currentQs = new URL(context.req.url).search.slice(1);
			if (currentQs) {
				const separator = finalTarget.includes("?") ? "&" : "?";
				finalTarget += separator + currentQs;
			}
		}

		// [QSD] - Query String Discard
		if (flags.qsDiscard) {
			const qsIndex = finalTarget.indexOf("?");
			if (qsIndex !== -1) {
				finalTarget = finalTarget.slice(0, qsIndex);
			}
		}

		// [NE] - No Escape (we already don't encode by default)
		// This would be handled if we were encoding

		return {
			type: "redirect",
			url: finalTarget,
			status: flags.redirect,
		};
	}

	// Internal rewrite (not supported in current implementation)
	return {
		type: "rewrite",
		path: target,
	};
}
