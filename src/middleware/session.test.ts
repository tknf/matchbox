import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { getSessionFromCookie, saveSessionToCookie } from "./session.js";

describe("session middleware", () => {
	describe("getSessionFromCookie", () => {
		test("returns empty object when no session cookie exists", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = await getSessionFromCookie(c);
				return c.json(session);
			});

			const res = await app.request("/");
			const json = await res.json();
			expect(json).toEqual({});
		});

		test("parses session data from cookie", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = await getSessionFromCookie(c);
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
			app.get("/", async (c) => {
				const session = await getSessionFromCookie(c, "CUSTOM_SESSION");
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
			app.get("/", async (c) => {
				const session = await getSessionFromCookie(c);
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
			app.get("/", async (c) => {
				const session = { userId: "789", role: "user" };
				await saveSessionToCookie(c, session);
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
			app.get("/", async (c) => {
				const session = { test: "data" };
				await saveSessionToCookie(c, session, { name: "MY_SESSION" });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("MY_SESSION=");
		});

		test("saves session data with secure flag", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = { secure: "data" };
				await saveSessionToCookie(c, session, { secure: true });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("Secure");
		});

		test("saves session data with custom domain", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = { domain: "data" };
				await saveSessionToCookie(c, session, { domain: "example.com" });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("Domain=example.com");
		});

		test("saves session data with maxAge", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = { maxAge: "data" };
				await saveSessionToCookie(c, session, { maxAge: 3600 });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("Max-Age=3600");
		});

		test("saves session data with custom SameSite", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = { samesite: "data" };
				await saveSessionToCookie(c, session, { sameSite: "Strict" });
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toContain("SameSite=Strict");
		});

		test("properly encodes session data", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = { special: "data with spaces & symbols" };
				await saveSessionToCookie(c, session);
				return c.text("OK");
			});

			const res = await app.request("/");
			const cookie = res.headers.get("set-cookie");
			expect(cookie).toBeTruthy();
			// Should contain URL-encoded JSON
			expect(cookie).toContain("%");
		});

		test("warns when the serialized cookie exceeds the size threshold", async () => {
			// A secret is passed so this only exercises the size-warning path, not
			// the (process-wide, once-only) missing-sessionSecret warning tested
			// separately below.
			const logs: Array<[string, string | undefined]> = [];
			const app = new Hono();
			app.get("/", async (c) => {
				const session = { big: "x".repeat(5000) };
				await saveSessionToCookie(c, session, undefined, "test-secret", (message, level) => {
					logs.push([message, level]);
				});
				return c.text("OK");
			});

			await app.request("/");
			expect(logs.some(([message, level]) => level === "warn" && message.includes("4000"))).toBe(
				true,
			);
		});

		test("does not warn when the serialized cookie is within the size threshold", async () => {
			const logs: string[] = [];
			const app = new Hono();
			app.get("/", async (c) => {
				await saveSessionToCookie(c, { small: "data" }, undefined, "test-secret", (message) => {
					logs.push(message);
				});
				return c.text("OK");
			});

			await app.request("/");
			expect(logs.some((message) => message.includes("byte"))).toBe(false);
		});
	});

	describe("HMAC-signed sessions (sessionSecret)", () => {
		test("round-trips session data through a signed cookie", async () => {
			const secret = "test-secret";
			const app = new Hono();
			app.get("/set", async (c) => {
				await saveSessionToCookie(c, { userId: "123", role: "admin" }, undefined, secret);
				return c.text("OK");
			});
			app.get("/get", async (c) => {
				const session = await getSessionFromCookie(c, undefined, secret);
				return c.json(session);
			});

			const setRes = await app.request("/set");
			const cookie = setRes.headers.get("set-cookie");
			expect(cookie).toBeTruthy();
			const cookieValue = cookie?.split(";")[0] ?? "";

			const getRes = await app.request("/get", { headers: { Cookie: cookieValue } });
			const json = await getRes.json();
			expect(json).toEqual({ userId: "123", role: "admin" });
		});

		test("rejects a tampered signed cookie", async () => {
			const secret = "test-secret";
			const app = new Hono();
			app.get("/set", async (c) => {
				await saveSessionToCookie(c, { role: "user" }, undefined, secret);
				return c.text("OK");
			});
			app.get("/get", async (c) => {
				const session = await getSessionFromCookie(c, undefined, secret);
				return c.json(session);
			});

			const setRes = await app.request("/set");
			const cookie = setRes.headers.get("set-cookie");
			const [name, value] = (cookie?.split(";")[0] ?? "").split("=");
			// Flip the payload so it no longer matches its signature, simulating a
			// client-side tampering attempt (e.g. trying to escalate role).
			const [payload, signature] = value.split(".");
			const tamperedCookie = `${name}=${payload}x.${signature}`;

			const getRes = await app.request("/get", { headers: { Cookie: tamperedCookie } });
			const json = await getRes.json();
			expect(json).toEqual({});
		});

		test("rejects a signed-format cookie verified with the wrong secret", async () => {
			const app = new Hono();
			app.get("/set", async (c) => {
				await saveSessionToCookie(c, { role: "admin" }, undefined, "secret-a");
				return c.text("OK");
			});
			app.get("/get", async (c) => {
				const session = await getSessionFromCookie(c, undefined, "secret-b");
				return c.json(session);
			});

			const setRes = await app.request("/set");
			const cookieValue = setRes.headers.get("set-cookie")?.split(";")[0] ?? "";

			const getRes = await app.request("/get", { headers: { Cookie: cookieValue } });
			expect(await getRes.json()).toEqual({});
		});

		test("treats a legacy unsigned cookie as invalid once sessionSecret is configured", async () => {
			const app = new Hono();
			app.get("/", async (c) => {
				const session = await getSessionFromCookie(c, undefined, "test-secret");
				return c.json(session);
			});

			const legacyValue = encodeURIComponent(JSON.stringify({ role: "admin" }));
			const res = await app.request("/", {
				headers: { Cookie: `_SESSION_ID=${legacyValue}` },
			});
			expect(await res.json()).toEqual({});
		});

		test("keeps the legacy unsigned cookie format when sessionSecret is not configured", async () => {
			const app = new Hono();
			app.get("/set", async (c) => {
				await saveSessionToCookie(c, { role: "user" });
				return c.text("OK");
			});
			app.get("/get", async (c) => {
				const session = await getSessionFromCookie(c);
				return c.json(session);
			});

			const setRes = await app.request("/set");
			const cookieValue = setRes.headers.get("set-cookie")?.split(";")[0] ?? "";
			// Legacy format has no "." separator between payload and signature.
			expect(cookieValue.split(".").length).toBe(1);

			const getRes = await app.request("/get", { headers: { Cookie: cookieValue } });
			expect(await getRes.json()).toEqual({ role: "user" });
		});

		test("warns at most once per process when sessionSecret is missing and a logger is provided", async () => {
			const logs: string[] = [];
			const logger = (message: string) => logs.push(message);
			const app = new Hono();
			app.get("/", async (c) => {
				const session = await getSessionFromCookie(c, undefined, undefined, logger);
				await saveSessionToCookie(c, { ...session, hit: true }, undefined, undefined, logger);
				return c.text("OK");
			});

			await app.request("/");
			await app.request("/");

			const warnings = logs.filter((message) => message.includes("sessionSecret"));
			expect(warnings.length).toBe(1);
		});
	});
});
