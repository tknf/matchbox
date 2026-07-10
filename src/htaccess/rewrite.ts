import type { Context } from "hono";
import type { RewriteCondition, RewriteRuleConfig } from "./types.js";
import {
	applyRewriteFlags,
	buildVariableContext,
	type ClientIpOptions,
	expandVariables,
	testCondition,
} from "./utils.js";

/**
 * Evaluate all conditions for a rewrite rule
 */
export function evaluateConditions(
	conditions: RewriteCondition[],
	context: Context,
	ipOptions?: ClientIpOptions,
): boolean {
	if (conditions.length === 0) return true;

	let result = true;
	let nextIsOr = false;

	for (const condition of conditions) {
		const varContext = buildVariableContext(context, ipOptions);
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
 * Create middleware for rewrite rules.
 *
 * `rule.pattern` and each condition's `pattern` are static once the
 * middleware is created, so they are compiled to `RegExp` a single time here
 * instead of on every request.
 */
export function createRewriteMiddleware(
	rules: RewriteRuleConfig[],
	basePath: string,
	ipOptions?: ClientIpOptions,
): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
	const compiledPatterns = rules.map(
		(rule) => new RegExp(rule.pattern, rule.flags.noCase ? "i" : ""),
	);
	const compiledConditions = rules.map((rule) =>
		rule.conditions.map((condition) => ({
			...condition,
			compiled: new RegExp(condition.pattern, condition.flags.noCase ? "i" : ""),
		})),
	);

	return async (c, next) => {
		const relPath = c.req.path.replace(basePath, "") || "/";

		for (let i = 0; i < rules.length; i++) {
			const rule = rules[i];

			// Evaluate conditions first
			if (!evaluateConditions(compiledConditions[i], c, ipOptions)) {
				continue;
			}

			// Test pattern
			const match = relPath.match(compiledPatterns[i]);

			if (!match) continue;

			// Apply backreference substitution ($0-$9), replacing plain string
			// tokens instead of compiling a new RegExp per capture group.
			let target = rule.target;
			for (let g = 0; g < match.length; g++) {
				target = target.split(`$${g}`).join(match[g] || "");
			}

			// Expand variables in target
			const varContext = buildVariableContext(c, ipOptions);
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
