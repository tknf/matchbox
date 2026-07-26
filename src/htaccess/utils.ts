import type { Context } from "hono";
import type { RewriteCondition, RewriteFlags, RewriteResult, VariableContext } from "./types.js";

/**
 * Options controlling how the client IP address is resolved from a request.
 * Shared by `$_SERVER.REMOTE_ADDR` (cgi.ts), the `%{REMOTE_ADDR}` htaccess
 * variable, and Allow/Deny IP matching so all three agree on the same value.
 */
export interface ClientIpOptions {
	/**
	 * Trust proxy-supplied headers (X-Forwarded-For, X-Real-IP) when resolving
	 * the client IP. Only enable this behind a reverse proxy that you control
	 * and that overwrites/strips these headers from client input itself —
	 * otherwise a client can spoof its IP to bypass Allow/Deny access control.
	 * Defaults to false (headers are ignored).
	 */
	trustProxy?: boolean;
}

/** Fallback client IP used when no address can be resolved. */
const DEFAULT_REMOTE_ADDR = "127.0.0.1";

/**
 * Resolve the client IP address for a request.
 *
 * With `trustProxy` disabled (the default), `X-Forwarded-For`/`X-Real-IP`
 * headers are ignored since they are attacker-controlled request input; the
 * connection-level address exposed via `c.env.REMOTE_ADDR` is used instead
 * (falling back to `127.0.0.1` when the runtime does not expose one). With
 * `trustProxy` enabled, the standard proxy header chain is honored first:
 * the first entry of `X-Forwarded-For`, then `X-Real-IP`, then the same
 * `c.env.REMOTE_ADDR` fallback.
 */
export function resolveClientIp(c: Context, options?: ClientIpOptions): string {
	if (options?.trustProxy) {
		const forwardedFor = c.req.header("x-forwarded-for");
		const firstForwarded = forwardedFor?.split(",")[0]?.trim();
		if (firstForwarded) return firstForwarded;

		const realIp = c.req.header("x-real-ip");
		if (realIp) return realIp;
	}

	const envRemoteAddr = c.env?.REMOTE_ADDR;
	if (typeof envRemoteAddr === "string" && envRemoteAddr) return envRemoteAddr;

	return DEFAULT_REMOTE_ADDR;
}

/**
 * Build variable context from Hono context
 */
export function buildVariableContext(c: Context, ipOptions?: ClientIpOptions): VariableContext {
	const url = new URL(c.req.url);

	return {
		HTTP_HOST: c.req.header("host") || "",
		HTTP_USER_AGENT: c.req.header("user-agent") || "",
		REQUEST_URI: c.req.path,
		QUERY_STRING: url.search.slice(1),
		HTTPS: url.protocol === "https:" ? "on" : "off",
		REMOTE_ADDR: resolveClientIp(c, ipOptions),
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
 * Test a single RewriteCond. Uses `condition.compiled` when present to avoid
 * recompiling the same regex on every request; otherwise compiles `pattern`
 * on demand.
 */
export function testCondition(condition: RewriteCondition, context: VariableContext): boolean {
	const testValue = expandVariables(condition.testString, context);
	const pattern =
		condition.compiled ?? new RegExp(condition.pattern, condition.flags.noCase ? "i" : "");
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

/**
 * IP address family recognized for CIDR matching.
 */
type IPFamily = "ipv4" | "ipv6";

const IPV4_MAX_PREFIX = 32;
const IPV6_MAX_PREFIX = 128;

/**
 * Detect the address family of an IP literal from its syntax alone
 * (":" implies IPv6, "." implies IPv4). Returns undefined when neither
 * applies, e.g. for a hostname.
 */
function detectIPFamily(address: string): IPFamily | undefined {
	if (address.includes(":")) return "ipv6";
	if (address.includes(".")) return "ipv4";
	return undefined;
}

/**
 * Parse a dotted-decimal IPv4 address into its 4 octets, or undefined if
 * the address is malformed.
 */
function parseIPv4(address: string): number[] | undefined {
	const parts = address.split(".");
	if (parts.length !== 4) return undefined;

	const octets = parts.map((part) =>
		/^\d{1,3}$/.test(part) ? Number.parseInt(part, 10) : Number.NaN,
	);
	if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) return undefined;

	return octets;
}

/**
 * Parse an IPv6 address, including "::" zero-run compression, into its 16
 * bytes. Returns undefined if the address is malformed.
 */
function parseIPv6(address: string): number[] | undefined {
	const doubleColonMatches = address.match(/::/g);
	if (doubleColonMatches && doubleColonMatches.length > 1) return undefined;

	const hasDoubleColon = address.includes("::");
	const sides = hasDoubleColon ? address.split("::") : [address];
	if (sides.length > 2) return undefined;

	const head = sides[0] ? sides[0].split(":") : [];
	const tail = hasDoubleColon && sides[1] ? sides[1].split(":") : [];

	// Without "::" compression, exactly 8 groups must be present.
	if (!hasDoubleColon && head.length !== 8) return undefined;

	const missingGroups = 8 - (head.length + tail.length);
	if (hasDoubleColon && missingGroups < 0) return undefined;

	const groups = hasDoubleColon ? [...head, ...Array(missingGroups).fill("0"), ...tail] : head;
	if (groups.length !== 8) return undefined;

	const bytes: number[] = [];
	for (const group of groups) {
		if (!/^[0-9a-fA-F]{1,4}$/.test(group)) return undefined;
		const value = Number.parseInt(group, 16);
		bytes.push((value >> 8) & 0xff, value & 0xff);
	}

	return bytes;
}

/**
 * Parse an address literal into bytes for the given family.
 */
function parseIPAddress(address: string, family: IPFamily): number[] | undefined {
	return family === "ipv4" ? parseIPv4(address) : parseIPv6(address);
}

/**
 * Compare two equal-length address byte arrays under a bitwise CIDR prefix
 * length. Works for both IPv4 (4 bytes) and IPv6 (16 bytes).
 */
function matchesPrefix(a: number[], b: number[], prefixBits: number): boolean {
	let remaining = prefixBits;
	for (let i = 0; i < a.length; i++) {
		if (remaining <= 0) break;

		const bits = Math.min(remaining, 8);
		const mask = bits >= 8 ? 0xff : (0xff << (8 - bits)) & 0xff;
		if ((a[i] & mask) !== (b[i] & mask)) return false;

		remaining -= 8;
	}

	return true;
}

/**
 * Validate a CIDR prefix length against the valid range for an address
 * family (0-32 for IPv4, 0-128 for IPv6). Throws when the value is missing,
 * non-numeric, or out of range.
 */
function assertValidPrefixLength(prefixText: string, family: IPFamily): number {
	const maxPrefix = family === "ipv4" ? IPV4_MAX_PREFIX : IPV6_MAX_PREFIX;
	if (!/^\d+$/.test(prefixText)) {
		throw new Error(`Invalid CIDR prefix length: "${prefixText}"`);
	}

	const prefixLength = Number.parseInt(prefixText, 10);
	if (prefixLength > maxPrefix) {
		throw new Error(
			`Invalid CIDR prefix length for ${family}: "${prefixText}" (expected 0-${maxPrefix})`,
		);
	}

	return prefixLength;
}

/**
 * Validate an Allow/Deny IP rule value at parse time, e.g. "192.168.1.0/24"
 * or "2001:db8::/32". Throws when the value contains a CIDR prefix length
 * that is missing, non-numeric, or out of range for the address family.
 * Values without a "/" (plain IPs, or non-IP literals like hostnames) are
 * left untouched.
 */
export function assertValidCidrNotation(value: string): void {
	const slashIndex = value.indexOf("/");
	if (slashIndex === -1) return;

	const network = value.slice(0, slashIndex);
	const prefixText = value.slice(slashIndex + 1);
	const family = detectIPFamily(network) ?? "ipv4";
	assertValidPrefixLength(prefixText, family);
}

/**
 * Check whether `clientIP` falls within the CIDR network `network/maskBits`.
 * Supports both IPv4 and IPv6 addresses (including "::" compression).
 *
 * Throws when `maskBits` is missing, non-numeric, or out of range for the
 * network's address family (0-32 for IPv4, 0-128 for IPv6) — this indicates
 * a misconfigured rule and must not be treated as "always match" or "never
 * match". A family mismatch between `clientIP` and `network` (e.g. an IPv4
 * client against an IPv6 rule) is always "no match", not an error, since
 * `clientIP` is untrusted request data rather than static configuration.
 */
export function isSameNetwork(clientIP: string, network: string, maskBits: number): boolean {
	const family = detectIPFamily(network);
	if (!family) {
		throw new Error(`Invalid network address in CIDR rule: "${network}"`);
	}

	const maxPrefix = family === "ipv4" ? IPV4_MAX_PREFIX : IPV6_MAX_PREFIX;
	if (!Number.isInteger(maskBits) || maskBits < 0 || maskBits > maxPrefix) {
		throw new Error(`Invalid CIDR prefix length for ${family} network "${network}": ${maskBits}`);
	}

	const networkBytes = parseIPAddress(network, family);
	if (!networkBytes) {
		throw new Error(`Invalid network address in CIDR rule: "${network}"`);
	}

	// A client IP of a different family than the rule's network never matches.
	if (detectIPFamily(clientIP) !== family) return false;

	const clientBytes = parseIPAddress(clientIP, family);
	if (!clientBytes) return false;

	return matchesPrefix(clientBytes, networkBytes, maskBits);
}
