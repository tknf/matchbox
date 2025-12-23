import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { applyHtaccessMiddleware, applyErrorDocumentMiddleware } from "./htaccess.js";
import type { HtaccessConfig } from "../htaccess/types.js";

describe("applyHtaccessMiddleware", () => {
	test("applies header middleware", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [{ name: "X-Custom-Header", value: "test-value", action: "set" }],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.headers.get("X-Custom-Header")).toBe("test-value");
	});

	test("applies rewrite middleware", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [],
				rewriteRules: [
					{
						type: "rewrite",
						pattern: "^/old$",
						target: "/new",
						flags: { redirect: 301 },
						conditions: [],
					},
				],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/old", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/new");
	});

	test("applies redirect middleware", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [],
				rewriteRules: [],
				redirects: [{ type: "redirect", source: "/old-page", target: "/new-page", code: 302 }],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/old-page", { redirect: "manual" });
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/new-page");
	});

	test("applies access control middleware", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/admin": {
				headers: [],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				accessControl: {
					order: "deny,allow",
					deny: [{ type: "all" }],
					allow: [],
				},
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/admin/test");
		expect(res.status).toBe(403);
	});

	test("applies multiple middleware in correct order", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [{ name: "X-Test", value: "1", action: "set" }],
				rewriteRules: [
					{
						type: "rewrite",
						pattern: "^/redirect-me$",
						target: "/redirected",
						flags: { redirect: 301 },
						conditions: [],
					},
				],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/redirect-me", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("X-Test")).toBe("1");
	});

	test("handles multiple directory configurations", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [{ name: "X-Root", value: "true", action: "set" }],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
			"/api": {
				headers: [{ name: "X-API", value: "true", action: "set" }],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res1 = await app.request("/test");
		expect(res1.headers.get("X-Root")).toBe("true");
		expect(res1.headers.get("X-API")).toBeNull();

		const res2 = await app.request("/api/test");
		expect(res2.headers.get("X-Root")).toBe("true");
		expect(res2.headers.get("X-API")).toBe("true");
	});

	test("skips empty configurations", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyHtaccessMiddleware(app, config);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});

describe("applyErrorDocumentMiddleware", () => {
	test("applies error document middleware", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [{ statusCode: 404, target: "/errors/404.html" }],
				accessControl: undefined,
			},
		};
		applyErrorDocumentMiddleware(app, config);

		const res = await app.request("/nonexistent");
		expect(res.status).toBe(404);
		expect(await res.text()).toBe("Error 404: See /errors/404.html");
	});

	test("applies error documents for specific directories", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/admin": {
				headers: [],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [{ statusCode: 404, target: "/admin/errors/404.html" }],
				accessControl: undefined,
			},
		};
		applyErrorDocumentMiddleware(app, config);

		const res = await app.request("/admin/nonexistent");
		expect(res.status).toBe(404);
		expect(await res.text()).toBe("Error 404: See /admin/errors/404.html");
	});

	test("skips directories without error documents", async () => {
		const app = new Hono();
		const config: HtaccessConfig = {
			"/": {
				headers: [],
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				accessControl: undefined,
			},
		};
		applyErrorDocumentMiddleware(app, config);
		app.get("/success", (c) => c.text("OK"));

		const res = await app.request("/success");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});
