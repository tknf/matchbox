import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import {
	expandVariables,
	buildVariableContext,
	testCondition,
	applyRewriteFlags,
} from "./utils.js";
import type { VariableContext, RewriteCondition, RewriteFlags } from "./types.js";

describe("htaccess utils", () => {
	describe("expandVariables", () => {
		const context: VariableContext = {
			HTTP_HOST: "www.example.com",
			HTTP_USER_AGENT: "Mozilla/5.0",
			REQUEST_URI: "/path/to/page",
			QUERY_STRING: "foo=bar&baz=qux",
			HTTPS: "on",
			REMOTE_ADDR: "192.168.1.100",
			REQUEST_METHOD: "GET",
			HTTP_REFERER: "https://google.com",
			HTTP_ACCEPT: "text/html",
			HTTP_COOKIE: "session=abc123",
			SERVER_NAME: "www.example.com",
			SERVER_PORT: "443",
			DOCUMENT_ROOT: "/var/www",
			REQUEST_FILENAME: "/path/to/page",
		};

		test("expands HTTP_HOST variable", () => {
			const result = expandVariables("%{HTTP_HOST}", context);
			expect(result).toBe("www.example.com");
		});

		test("expands REQUEST_URI variable", () => {
			const result = expandVariables("%{REQUEST_URI}", context);
			expect(result).toBe("/path/to/page");
		});

		test("expands multiple variables", () => {
			const result = expandVariables("%{HTTP_HOST}%{REQUEST_URI}", context);
			expect(result).toBe("www.example.com/path/to/page");
		});

		test("expands variables with surrounding text", () => {
			const result = expandVariables("Host: %{HTTP_HOST}, Path: %{REQUEST_URI}", context);
			expect(result).toBe("Host: www.example.com, Path: /path/to/page");
		});

		test("returns string unchanged if no variables present", () => {
			const result = expandVariables("no variables here", context);
			expect(result).toBe("no variables here");
		});

		test("handles unknown variables by leaving them as-is", () => {
			const result = expandVariables("%{UNKNOWN_VAR}", context);
			expect(result).toBe("%{UNKNOWN_VAR}");
		});

		test("expands HTTPS variable", () => {
			const result = expandVariables("%{HTTPS}", context);
			expect(result).toBe("on");
		});

		test("expands REQUEST_METHOD variable", () => {
			const result = expandVariables("%{REQUEST_METHOD}", context);
			expect(result).toBe("GET");
		});

		test("expands REMOTE_ADDR variable", () => {
			const result = expandVariables("%{REMOTE_ADDR}", context);
			expect(result).toBe("192.168.1.100");
		});

		test("expands QUERY_STRING variable", () => {
			const result = expandVariables("%{QUERY_STRING}", context);
			expect(result).toBe("foo=bar&baz=qux");
		});

		test("expands SERVER_NAME variable", () => {
			const result = expandVariables("%{SERVER_NAME}", context);
			expect(result).toBe("www.example.com");
		});

		test("expands SERVER_PORT variable", () => {
			const result = expandVariables("%{SERVER_PORT}", context);
			expect(result).toBe("443");
		});
	});

	describe("buildVariableContext", () => {
		test("builds context from Hono request", async () => {
			const app = new Hono();
			let capturedContext: VariableContext | undefined;

			app.get("/test", (c) => {
				capturedContext = buildVariableContext(c);
				return c.text("OK");
			});

			await app.request("https://example.com/test?foo=bar", {
				headers: {
					Host: "example.com",
					"User-Agent": "TestAgent",
					Referer: "https://google.com",
					Accept: "text/html",
				},
			});

			expect(capturedContext).toBeTruthy();
			expect(capturedContext?.HTTP_HOST).toBe("example.com");
			expect(capturedContext?.HTTP_USER_AGENT).toBe("TestAgent");
			expect(capturedContext?.REQUEST_URI).toBe("/test");
			expect(capturedContext?.QUERY_STRING).toBe("foo=bar");
			expect(capturedContext?.HTTPS).toBe("on");
			expect(capturedContext?.REQUEST_METHOD).toBe("GET");
			expect(capturedContext?.HTTP_REFERER).toBe("https://google.com");
		});

		test("handles HTTP protocol", async () => {
			const app = new Hono();
			let capturedContext: VariableContext | undefined;

			app.get("/test", (c) => {
				capturedContext = buildVariableContext(c);
				return c.text("OK");
			});

			await app.request("http://example.com/test");

			expect(capturedContext?.HTTPS).toBe("off");
			expect(capturedContext?.SERVER_PORT).toBe("80");
		});

		test("extracts REMOTE_ADDR from X-Forwarded-For header", async () => {
			const app = new Hono();
			let capturedContext: VariableContext | undefined;

			app.get("/test", (c) => {
				capturedContext = buildVariableContext(c);
				return c.text("OK");
			});

			await app.request("/test", {
				headers: {
					"X-Forwarded-For": "203.0.113.1, 192.168.1.1",
				},
			});

			expect(capturedContext?.REMOTE_ADDR).toBe("203.0.113.1");
		});
	});

	describe("testCondition", () => {
		const context: VariableContext = {
			HTTP_HOST: "www.example.com",
			HTTP_USER_AGENT: "Mozilla/5.0",
			REQUEST_URI: "/test/page",
			QUERY_STRING: "",
			HTTPS: "on",
			REMOTE_ADDR: "192.168.1.1",
			REQUEST_METHOD: "GET",
			HTTP_REFERER: "",
			HTTP_ACCEPT: "text/html",
			HTTP_COOKIE: "",
			SERVER_NAME: "www.example.com",
			SERVER_PORT: "443",
			DOCUMENT_ROOT: "",
			REQUEST_FILENAME: "",
		};

		test("matches condition when pattern matches", () => {
			const condition: RewriteCondition = {
				testString: "%{HTTP_HOST}",
				pattern: "www\\.example\\.com",
				flags: {},
			};

			expect(testCondition(condition, context)).toBe(true);
		});

		test("does not match when pattern does not match", () => {
			const condition: RewriteCondition = {
				testString: "%{HTTP_HOST}",
				pattern: "other\\.com",
				flags: {},
			};

			expect(testCondition(condition, context)).toBe(false);
		});

		test("supports case-insensitive matching", () => {
			const condition: RewriteCondition = {
				testString: "%{HTTP_HOST}",
				pattern: "WWW\\.EXAMPLE\\.COM",
				flags: { noCase: true },
			};

			expect(testCondition(condition, context)).toBe(true);
		});

		test("matches regex patterns", () => {
			const condition: RewriteCondition = {
				testString: "%{REQUEST_URI}",
				pattern: "^/test/.*$",
				flags: {},
			};

			expect(testCondition(condition, context)).toBe(true);
		});
	});

	describe("applyRewriteFlags", () => {
		test("returns forbidden for F flag", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				const flags: RewriteFlags = { forbidden: true };
				result = applyRewriteFlags("/target", flags, c);
				return c.text("OK");
			});

			await app.request("/test");

			expect(result).toEqual({ type: "forbidden" });
		});

		test("returns gone for G flag", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				const flags: RewriteFlags = { gone: true };
				result = applyRewriteFlags("/target", flags, c);
				return c.text("OK");
			});

			await app.request("/test");

			expect(result).toEqual({ type: "gone" });
		});

		test("returns redirect for R flag", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				const flags: RewriteFlags = { redirect: 301 };
				result = applyRewriteFlags("/new-location", flags, c);
				return c.text("OK");
			});

			await app.request("/test");

			expect(result).toEqual({
				type: "redirect",
				url: "/new-location",
				status: 301,
			});
		});

		test("appends query string with QSA flag", async () => {
			const app = new Hono();
			let result: unknown;

			app.get("/test", (c) => {
				const flags: RewriteFlags = { redirect: 302, qsAppend: true };
				result = applyRewriteFlags("/target?new=param", flags, c);
				return c.text("OK");
			});

			await app.request("/test?existing=value");

			expect(result).toMatchObject({
				type: "redirect",
				status: 302,
			});
			expect((result as { url: string }).url).toContain("new=param");
			expect((result as { url: string }).url).toContain("existing=value");
		});

		test("discards query string with QSD flag", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				const flags: RewriteFlags = { redirect: 302, qsDiscard: true };
				result = applyRewriteFlags("/target?param=value", flags, c);
				return c.text("OK");
			});

			await app.request("/test");

			expect(result).toEqual({
				type: "redirect",
				url: "/target",
				status: 302,
			});
		});

		test("returns rewrite for internal rewrite", async () => {
			const app = new Hono();
			let result;

			app.get("/test", (c) => {
				const flags: RewriteFlags = {};
				result = applyRewriteFlags("/target", flags, c);
				return c.text("OK");
			});

			await app.request("/test");

			expect(result).toEqual({
				type: "rewrite",
				path: "/target",
			});
		});
	});
});
