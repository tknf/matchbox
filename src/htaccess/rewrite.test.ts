import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { createRewriteMiddleware, evaluateConditions } from "./rewrite.js";
import type { RewriteRuleConfig, RewriteCondition } from "./types.js";

describe("createRewriteMiddleware", () => {
	describe("basic rewrites", () => {
		test("performs simple redirect with R flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/old-page$",
					target: "/new-page",
					flags: { redirect: 301 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/old-page", { redirect: "manual" });
			expect(res.status).toBe(301);
			expect(res.headers.get("location")).toBe("/new-page");
		});

		test("returns 403 Forbidden with F flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/forbidden$",
					target: "-",
					flags: { forbidden: true },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/forbidden");
			expect(res.status).toBe(403);
			expect(await res.text()).toBe("Forbidden");
		});

		test("returns 410 Gone with G flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/gone$",
					target: "-",
					flags: { gone: true },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/gone");
			expect(res.status).toBe(410);
			expect(await res.text()).toBe("Gone");
		});
	});

	describe("pattern matching", () => {
		test("matches patterns with regex and backreferences", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/product/([0-9]+)$",
					target: "/products?id=$1",
					flags: { redirect: 302 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/product/123", { redirect: "manual" });
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/products?id=123");
		});

		test("supports case-insensitive matching with NC flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/about$",
					target: "/about-us",
					flags: { noCase: true, redirect: 302 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res1 = await app.request("/ABOUT", { redirect: "manual" });
			expect(res1.status).toBe(302);

			const res2 = await app.request("/About", { redirect: "manual" });
			expect(res2.status).toBe(302);
		});
	});

	describe("RewriteCond conditions", () => {
		test("applies rule when condition matches", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/(.*)$",
					target: "/mobile/$1",
					flags: { redirect: 302 },
					conditions: [
						{
							testString: "%{HTTP_USER_AGENT}",
							pattern: "Mobile",
							flags: {},
						},
					],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/page", {
				headers: { "User-Agent": "Mobile Safari" },
				redirect: "manual",
			});
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/mobile/page");
		});

		test("does not apply rule when condition does not match", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/(.*)$",
					target: "/mobile/$1",
					flags: { redirect: 302 },
					conditions: [
						{
							testString: "%{HTTP_USER_AGENT}",
							pattern: "Mobile",
							flags: {},
						},
					],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));
			app.get("*", (c) => c.text("Desktop"));

			const res = await app.request("/page", {
				headers: { "User-Agent": "Desktop Browser" },
			});
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("Desktop");
		});
	});

	describe("query string handling", () => {
		test("appends query string with QSA flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/old$",
					target: "/new?added=param",
					flags: { qsAppend: true, redirect: 302 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/old?existing=value", { redirect: "manual" });
			expect(res.status).toBe(302);
			const location = res.headers.get("location");
			expect(location).toContain("added=param");
			expect(location).toContain("existing=value");
		});

		test("discards query string with QSD flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/page$",
					target: "/clean?param=value",
					flags: { qsDiscard: true, redirect: 302 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/page?should=discard", { redirect: "manual" });
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/clean");
		});
	});

	describe("L flag (last)", () => {
		test("stops processing rules after match with L flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/test$",
					target: "/first",
					flags: { last: true, redirect: 302 },
					conditions: [],
				},
				{
					type: "rewrite",
					pattern: "^/test$",
					target: "/second",
					flags: { redirect: 302 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/test", { redirect: "manual" });
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/first");
		});

		test("continues processing rules without L flag", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/nomatch$",
					target: "/first",
					flags: { redirect: 302 },
					conditions: [],
				},
				{
					type: "rewrite",
					pattern: "^/test$",
					target: "/second",
					flags: { redirect: 302 },
					conditions: [],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/test", { redirect: "manual" });
			expect(res.status).toBe(302);
			expect(res.headers.get("location")).toBe("/second");
		});
	});

	describe("evaluateConditions", () => {
		test("returns true when no conditions are provided", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				result = evaluateConditions([], c);
				return c.text("OK");
			});

			await app.request("/test");
			expect(result).toBe(true);
		});

		test("evaluates single condition correctly", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				const conditions: RewriteCondition[] = [
					{
						testString: "%{HTTP_HOST}",
						pattern: "example\\.com",
						flags: {},
					},
				];
				result = evaluateConditions(conditions, c);
				return c.text("OK");
			});

			await app.request("/test", {
				headers: { Host: "example.com" },
			});

			expect(result).toBe(true);
		});

		test("evaluates multiple AND conditions correctly", async () => {
			const app = new Hono();
			let result;

			app.post("/test", (c) => {
				const conditions: RewriteCondition[] = [
					{
						testString: "%{REQUEST_METHOD}",
						pattern: "POST",
						flags: {},
					},
					{
						testString: "%{HTTP_USER_AGENT}",
						pattern: "TestAgent",
						flags: {},
					},
				];
				result = evaluateConditions(conditions, c);
				return c.text("OK");
			});

			await app.request("/test", {
				method: "POST",
				headers: { "User-Agent": "TestAgent" },
			});

			expect(result).toBe(true);
		});
	});
});

	describe("OR conditions", () => {
		test("evaluates OR conditions correctly", async () => {
			const app = new Hono();
			const rules: RewriteRuleConfig[] = [
				{
					type: "rewrite",
					pattern: "^/(.*)$",
					target: "/special/$1",
					flags: { redirect: 302 },
					conditions: [
						{
							testString: "%{HTTP_USER_AGENT}",
							pattern: "Bot1",
							flags: { or: true },
						},
						{
							testString: "%{HTTP_USER_AGENT}",
							pattern: "Bot2",
							flags: {},
						},
					],
				},
			];
			app.use("*", createRewriteMiddleware(rules, ""));

			const res = await app.request("/page", {
				headers: { "User-Agent": "Bot1" },
				redirect: "manual",
			});
			expect(res.status).toBe(302);
		});
	});
