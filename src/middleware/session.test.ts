import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { getSessionFromCookie, saveSessionToCookie } from "./session.js";

describe("session middleware", () => {
	describe("getSessionFromCookie", () => {
		test("returns empty object when no session cookie exists", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = getSessionFromCookie(c);
				return c.json(session);
			});

			const res = await app.request("/");
			const json = await res.json();
			expect(json).toEqual({});
		});

		test("parses session data from cookie", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = getSessionFromCookie(c);
				return c.json(session);
			});

			const sessionData = { userId: "123", role: "admin" };
			const encodedSession = encodeURIComponent(JSON.stringify(sessionData));

			const res = await app.request("/", {
				headers: {
					Cookie: `_SESSION_ID=${encodedSession}`,
				},
			});
			const json = await res.json();
			expect(json).toEqual(sessionData);
		});

		test("uses custom session cookie name", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = getSessionFromCookie(c, "CUSTOM_SESSION");
				return c.json(session);
			});

			const sessionData = { userId: "456" };
			const encodedSession = encodeURIComponent(JSON.stringify(sessionData));

			const res = await app.request("/", {
				headers: {
					Cookie: `CUSTOM_SESSION=${encodedSession}`,
				},
			});
			const json = await res.json();
			expect(json).toEqual(sessionData);
		});

		test("returns empty object for invalid JSON in cookie", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = getSessionFromCookie(c);
				return c.json(session);
			});

			const res = await app.request("/", {
				headers: {
					Cookie: "_SESSION_ID=invalid-json",
				},
			});
			const json = await res.json();
			expect(json).toEqual({});
		});
	});

	describe("saveSessionToCookie", () => {
		test("saves session data to cookie with default options", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { userId: "789", role: "user" };
				saveSessionToCookie(c, session);
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("_SESSION_ID=");
			expect(cookie).toContain("Path=/");
			expect(cookie).toContain("HttpOnly");
			expect(cookie).toContain("SameSite=Lax");
		});

		test("saves session data with custom cookie name", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { test: "data" };
				saveSessionToCookie(c, session, { name: "MY_SESSION" });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("MY_SESSION=");
		});

		test("saves session data with secure flag", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { secure: "data" };
				saveSessionToCookie(c, session, { secure: true });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("Secure");
		});

		test("saves session data with custom domain", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { domain: "data" };
				saveSessionToCookie(c, session, { domain: "example.com" });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("Domain=example.com");
		});

		test("saves session data with maxAge", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { maxAge: "data" };
				saveSessionToCookie(c, session, { maxAge: 3600 });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("Max-Age=3600");
		});

		test("saves session data with custom SameSite", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { samesite: "data" };
				saveSessionToCookie(c, session, { sameSite: "Strict" });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("SameSite=Strict");
		});

		test("properly encodes session data", async () => {
			const app = new Hono();
			app.get("/", (c) => {
				const session = { special: "data with spaces & symbols" };
				saveSessionToCookie(c, session);
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toBeTruthy();
			// Should contain URL-encoded JSON
			expect(cookie).toContain("%");
		});
	});
});
