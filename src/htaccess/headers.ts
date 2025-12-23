import type { Context } from "hono";
import type { HeaderConfig } from "./types.js";

/**
 * Create middleware for header directives
 */
export function createHeaderMiddleware(
	headers: HeaderConfig[],
): (c: Context, next: () => Promise<void>) => Promise<void> {
	return async (c, next) => {
		await next();

		for (const header of headers) {
			switch (header.action) {
				case "set":
					if (header.value) {
						c.header(header.name, header.value);
					}
					break;

				case "append":
					if (header.value) {
						const existing = c.res.headers.get(header.name);
						const newValue = existing ? `${existing}, ${header.value}` : header.value;
						c.header(header.name, newValue);
					}
					break;

				case "unset":
					c.res.headers.delete(header.name);
					break;
			}
		}
	};
}

/**
 * Predefined security header helpers
 */
export const securityHeaders = {
	xFrameOptions: (value: "DENY" | "SAMEORIGIN" | string): HeaderConfig => ({
		action: "set",
		name: "X-Frame-Options",
		value,
	}),

	xContentTypeOptions: (): HeaderConfig => ({
		action: "set",
		name: "X-Content-Type-Options",
		value: "nosniff",
	}),

	xssProtection: (enabled = true): HeaderConfig => ({
		action: "set",
		name: "X-XSS-Protection",
		value: enabled ? "1; mode=block" : "0",
	}),

	hsts: (maxAge = 31536000, includeSubdomains = true): HeaderConfig => ({
		action: "set",
		name: "Strict-Transport-Security",
		value: includeSubdomains ? `max-age=${maxAge}; includeSubDomains` : `max-age=${maxAge}`,
	}),

	csp: (policy: string): HeaderConfig => ({
		action: "set",
		name: "Content-Security-Policy",
		value: policy,
	}),

	referrerPolicy: (policy: string): HeaderConfig => ({
		action: "set",
		name: "Referrer-Policy",
		value: policy,
	}),

	permissionsPolicy: (policy: string): HeaderConfig => ({
		action: "set",
		name: "Permissions-Policy",
		value: policy,
	}),
};

/**
 * CORS (Cross-Origin Resource Sharing) header helpers
 */
export const corsHeaders = {
	allowOrigin: (origin: string): HeaderConfig => ({
		action: "set",
		name: "Access-Control-Allow-Origin",
		value: origin,
	}),

	allowMethods: (methods: string[]): HeaderConfig => ({
		action: "set",
		name: "Access-Control-Allow-Methods",
		value: methods.join(", "),
	}),

	allowHeaders: (headers: string[]): HeaderConfig => ({
		action: "set",
		name: "Access-Control-Allow-Headers",
		value: headers.join(", "),
	}),

	allowCredentials: (allow = true): HeaderConfig => ({
		action: "set",
		name: "Access-Control-Allow-Credentials",
		value: allow ? "true" : "false",
	}),

	maxAge: (seconds: number): HeaderConfig => ({
		action: "set",
		name: "Access-Control-Max-Age",
		value: String(seconds),
	}),

	exposeHeaders: (headers: string[]): HeaderConfig => ({
		action: "set",
		name: "Access-Control-Expose-Headers",
		value: headers.join(", "),
	}),
};
