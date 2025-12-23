import type { Context } from "hono";
import type { RewriteCondition, RewriteRuleConfig } from "./types.js";
import {
	applyRewriteFlags,
	buildVariableContext,
	expandVariables,
	testCondition,
} from "./utils.js";

/**
 * Evaluate all conditions for a rewrite rule
 */
export function evaluateConditions(conditions: RewriteCondition[], context: Context): boolean {
	if (conditions.length === 0) return true;

	let result = true;
	let nextIsOr = false;

	for (const condition of conditions) {
		const varContext = buildVariableContext(context);
		const match = testCondition(condition, varContext);

		if (nextIsOr) {
			result = result || match;
			nextIsOr = condition.flags.or || false;
		} else {
			result = result && match;
			nextIsOr = condition.flags.or || false;
		}
	}

	return result;
}

/**
 * Create middleware for rewrite rules
 */
export function createRewriteMiddleware(
	rules: RewriteRuleConfig[],
	basePath: string,
): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
	return async (c, next) => {
		const relPath = c.req.path.replace(basePath, "") || "/";

		for (const rule of rules) {
			// Evaluate conditions first
			if (!evaluateConditions(rule.conditions, c)) {
				continue;
			}

			// Test pattern
			const pattern = new RegExp(rule.pattern, rule.flags.noCase ? "i" : "");
			const match = relPath.match(pattern);

			if (!match) continue;

			// Apply backreference substitution
			let target = rule.target;
			for (let i = 0; i < match.length; i++) {
				target = target.replace(new RegExp(`\\$${i}`, "g"), match[i] || "");
			}

			// Expand variables in target
			const varContext = buildVariableContext(c);
			target = expandVariables(target, varContext);

			// Handle relative paths - prefix with basePath if target doesn't start with /
			if (
				target !== "-" &&
				!target.startsWith("/") &&
				!target.startsWith("http://") &&
				!target.startsWith("https://")
			) {
				target = basePath === "" ? `/${target}` : `${basePath}/${target}`;
			}

			// Apply flags
			const result = applyRewriteFlags(target, rule.flags, c);

			switch (result.type) {
				case "redirect":
					// Return Response directly to preserve relative URLs in Location header
					return new Response(null, {
						status: result.status,
						headers: {
							Location: result.url,
						},
					});

				case "forbidden":
					return c.text("Forbidden", 403);

				case "gone":
					return c.text("Gone", 410);

				case "rewrite":
					// Internal rewrite not supported
					break;
			}

			// [L] - Last rule
			if (rule.flags.last) {
				break;
			}
		}

		await next();
	};
}
