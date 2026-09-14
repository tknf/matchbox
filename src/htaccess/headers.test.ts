import { describe, expect, test } from "vite-plus/test";
import { createHeaderMiddleware, securityHeaders, corsHeaders } from "./headers.js";
import type { HeaderConfig } from "./types.js";
import { Hono } from "hono";

describe("Header Middleware", () => {
	describe("set action", () => {
		test("should set header", async () => {
			const config: HeaderConfig[] = [
				{ action: "set", name: "X-Custom-Header", value: "custom-value" },
			];

			const middleware = createHeaderMiddleware(config);
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test");
			expect(res.headers.get("X-Custom-Header")).toBe("custom-value");
		});
	});

	describe("append action", () => {
		test("should append to existing header", async () => {
			const config: HeaderConfig[] = [
				{ action: "append", name: "X-Custom-Header", value: "value2" },
			];

			const middleware = createHeaderMiddleware(config);
			const app = new Hono();
			app.use("*", middleware);
			app.use("*", async (c, next) => {
				c.header("X-Custom-Header", "value1");
				await next();
			});
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test");
			const headerValue = res.headers.get("X-Custom-Header");
			expect(headerValue).toContain("value1");
			expect(headerValue).toContain("value2");
		});
	});

	describe("unset action", () => {
		test("should remove header", async () => {
			const config: HeaderConfig[] = [{ action: "unset", name: "X-Remove-Me" }];

			const middleware = createHeaderMiddleware(config);
			const app = new Hono();
			app.use("*", async (c, next) => {
				c.header("X-Remove-Me", "should-be-removed");
				await next();
			});
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test");
			expect(res.headers.get("X-Remove-Me")).toBeNull();
		});
	});
});

describe("Security Headers", () => {
	test("should create X-Frame-Options header", () => {
		const header = securityHeaders.xFrameOptions("SAMEORIGIN");
		expect(header).toEqual({
			action: "set",
			name: "X-Frame-Options",
			value: "SAMEORIGIN",
		});
	});

	test("should create X-Content-Type-Options header", () => {
		const header = securityHeaders.xContentTypeOptions();
		expect(header).toEqual({
			action: "set",
			name: "X-Content-Type-Options",
			value: "nosniff",
		});
	});

	test("should create X-XSS-Protection header", () => {
		const header = securityHeaders.xssProtection(true);
		expect(header).toEqual({
			action: "set",
			name: "X-XSS-Protection",
			value: "1; mode=block",
		});
	});

	test("should create HSTS header", () => {
		const header = securityHeaders.hsts(31536000, true);
		expect(header).toEqual({
			action: "set",
			name: "Strict-Transport-Security",
			value: "max-age=31536000; includeSubDomains",
		});
	});

	test("should create CSP header", () => {
		const header = securityHeaders.csp("default-src 'self'");
		expect(header).toEqual({
			action: "set",
			name: "Content-Security-Policy",
			value: "default-src 'self'",
		});
	});

	test("should create Referrer-Policy header", () => {
		const header = securityHeaders.referrerPolicy("no-referrer");
		expect(header).toEqual({
			action: "set",
			name: "Referrer-Policy",
			value: "no-referrer",
		});
	});

	test("should create Permissions-Policy header", () => {
		const header = securityHeaders.permissionsPolicy("geolocation=()");
		expect(header).toEqual({
			action: "set",
			name: "Permissions-Policy",
			value: "geolocation=()",
		});
	});
});

describe("CORS Headers", () => {
	test("should create Allow-Origin header", () => {
		const header = corsHeaders.allowOrigin("https://example.com");
		expect(header).toEqual({
			action: "set",
			name: "Access-Control-Allow-Origin",
			value: "https://example.com",
		});
	});

	test("should create Allow-Methods header", () => {
		const header = corsHeaders.allowMethods(["GET", "POST", "PUT"]);
		expect(header).toEqual({
			action: "set",
			name: "Access-Control-Allow-Methods",
			value: "GET, POST, PUT",
		});
	});

	test("should create Allow-Headers header", () => {
		const header = corsHeaders.allowHeaders(["Content-Type", "Authorization"]);
		expect(header).toEqual({
			action: "set",
			name: "Access-Control-Allow-Headers",
			value: "Content-Type, Authorization",
		});
	});

	test("should create Allow-Credentials header", () => {
		const header = corsHeaders.allowCredentials(true);
		expect(header).toEqual({
			action: "set",
			name: "Access-Control-Allow-Credentials",
			value: "true",
		});
	});

	test("should create Max-Age header", () => {
		const header = corsHeaders.maxAge(3600);
		expect(header).toEqual({
			action: "set",
			name: "Access-Control-Max-Age",
			value: "3600",
		});
	});

	test("should create Expose-Headers header", () => {
		const header = corsHeaders.exposeHeaders(["X-Custom-Header"]);
		expect(header).toEqual({
			action: "set",
			name: "Access-Control-Expose-Headers",
			value: "X-Custom-Header",
		});
	});
});

describe("Header append action", () => {
	test("should append to existing header", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([
			{ action: "set", name: "X-Custom", value: "first" },
			{ action: "append", name: "X-Custom", value: "second" },
		]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("X-Custom")).toBe("first, second");
	});

	test("should append when no existing header", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([
			{ action: "append", name: "X-New", value: "value" },
		]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("X-New")).toBe("value");
	});
});

describe("Header unset action", () => {
	test("should remove header", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([
			{ action: "set", name: "X-Remove-Me", value: "value" },
			{ action: "unset", name: "X-Remove-Me", value: "" },
		]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("X-Remove-Me")).toBeNull();
	});
});

describe("Header edge cases", () => {
	test("should handle header with empty value in set action", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([{ action: "set", name: "X-Empty", value: "" }]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		// Empty value should not set the header
		expect(res.headers.get("X-Empty")).toBeNull();
	});

	test("should handle header with empty value in append action", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([{ action: "append", name: "X-Empty", value: "" }]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		// Empty value should not append
		expect(res.headers.get("X-Empty")).toBeNull();
	});
});

describe("Security header helpers", () => {
	test("should create xssProtection header with disabled", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([securityHeaders.xssProtection(false)]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("X-XSS-Protection")).toBe("0");
	});

	test("should create hsts header without includeSubdomains", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([securityHeaders.hsts(31536000, false)]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000");
	});

	test("should create allowCredentials header with false", async () => {
		const app = new Hono();
		const middleware = createHeaderMiddleware([corsHeaders.allowCredentials(false)]);

		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("false");
	});
});
