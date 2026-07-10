import type { Context } from "hono";
import type { AccessControlConfig, AccessRule } from "./types.js";
import { type ClientIpOptions, isSameNetwork, resolveClientIp } from "./utils.js";

/**
 * Check if an IP address matches a rule. Supports exact matches and CIDR
 * notation (IPv4 and IPv6, via `isSameNetwork`).
 */
function matchesIP(clientIP: string, ruleValue: string | string[]): boolean {
	const ips = Array.isArray(ruleValue) ? ruleValue : [ruleValue];

	for (const ip of ips) {
		// Exact match
		if (clientIP === ip) return true;

		// CIDR notation check
		if (ip.includes("/")) {
			const [network, bits] = ip.split("/");
			const maskBits = /^\d+$/.test(bits) ? Number.parseInt(bits, 10) : Number.NaN;
			if (isSameNetwork(clientIP, network, maskBits)) return true;
		}
	}

	return false;
}

/**
 * Check if a hostname matches a rule
 */
function matchesHost(clientHost: string, ruleValue: string | string[]): boolean {
	const hosts = Array.isArray(ruleValue) ? ruleValue : [ruleValue];

	for (const host of hosts) {
		// Exact match
		if (clientHost === host) return true;

		// Wildcard match (*.example.com)
		if (host.startsWith("*.")) {
			const domain = host.slice(2);
			if (clientHost.endsWith(domain)) return true;
		}
	}

	return false;
}

/**
 * Check if a request matches an access rule
 */
function matchesRule(rule: AccessRule, c: Context, ipOptions?: ClientIpOptions): boolean {
	switch (rule.type) {
		case "all":
			return true;

		case "ip": {
			const clientIP = resolveClientIp(c, ipOptions);
			return rule.value ? matchesIP(clientIP, rule.value) : false;
		}

		case "host": {
			// Get client hostname (reverse DNS lookup not available, use IP)
			const clientHost = c.req.header("host") || "";
			return rule.value ? matchesHost(clientHost, rule.value) : false;
		}

		case "env": {
			// Check environment variable
			if (!rule.value) return false;
			const envVar = typeof rule.value === "string" ? rule.value : rule.value[0];
			return c.env?.[envVar] !== undefined;
		}

		default:
			return false;
	}
}

/**
 * Evaluate access control rules
 */
function evaluateAccessControl(
	config: AccessControlConfig,
	c: Context,
	ipOptions?: ClientIpOptions,
): boolean {
	const order = config.order || "allow,deny";

	// Check if request matches allow rules
	const allowMatches = config.allow.some((rule) => matchesRule(rule, c, ipOptions));

	// Check if request matches deny rules
	const denyMatches = config.deny.some((rule) => matchesRule(rule, c, ipOptions));

	// Apply order logic
	switch (order) {
		case "allow,deny":
			// Allow rules processed first, then deny rules
			// If matches allow, granted (unless also matches deny)
			// If matches deny, denied
			// If matches neither, denied
			if (denyMatches) return false;
			if (allowMatches) return true;
			return false;

		case "deny,allow":
			// Deny rules processed first, then allow rules
			// If matches deny, denied (unless also matches allow)
			// If matches allow, granted
			// If matches neither, granted
			if (allowMatches) return true;
			if (denyMatches) return false;
			return true;

		case "mutual-failure":
			// Must match allow AND not match deny
			if (denyMatches) return false;
			if (allowMatches) return true;
			return false;

		default:
			return false;
	}
}

/**
 * Create middleware for access control (Order/Allow/Deny)
 */
export function createAccessControlMiddleware(
	config: AccessControlConfig,
	ipOptions?: ClientIpOptions,
): (c: Context, next: () => Promise<void>) => Promise<Response | void> {
	return async (c, next) => {
		const allowed = evaluateAccessControl(config, c, ipOptions);

		if (!allowed) {
			return c.text("Forbidden", 403);
		}

		await next();
	};
}
