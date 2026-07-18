import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { applyBasicAuth } from "./auth.js";

describe("applyBasicAuth", () => {
	test("allows access without authentication when no auth map is provided", async () => {
		const app = new Hono();
		applyBasicAuth(app, {});
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/test");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("requires authentication for protected directory", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "admin:secret123",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/admin/dashboard");
		expect(res.status).toBe(401);
	});

	test("allows access with correct credentials", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "admin:secret123",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const credentials = btoa("admin:secret123");
		const res = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("denies access with incorrect credentials", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "admin:secret123",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const credentials = btoa("admin:wrongpassword");
		const res = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		expect(res.status).toBe(401);
	});

	test("supports multiple users in htpasswd format", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "admin:secret123\nuser:pass456",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const credentials1 = btoa("admin:secret123");
		const res1 = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials1}`,
			},
		});
		expect(res1.status).toBe(200);

		const credentials2 = btoa("user:pass456");
		const res2 = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials2}`,
			},
		});
		expect(res2.status).toBe(200);
	});

	test("ignores comments in htpasswd content", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "# This is a comment\nadmin:secret123\n# Another comment",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const credentials = btoa("admin:secret123");
		const res = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		expect(res.status).toBe(200);
	});

	test("ignores empty lines in htpasswd content", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "\nadmin:secret123\n\nuser:pass456\n",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const credentials = btoa("admin:secret123");
		const res = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		expect(res.status).toBe(200);
	});

	test("applies auth to root directory with wildcard pattern", async () => {
		const app = new Hono();
		const authMap = {
			"/": "root:password",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/any/path");
		expect(res.status).toBe(401);

		const credentials = btoa("root:password");
		const res2 = await app.request("/any/path", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		expect(res2.status).toBe(200);
	});

	test("applies auth only to specific directory and subdirectories", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "admin:secret",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		// Public path should not require auth
		const res1 = await app.request("/public/page");
		expect(res1.status).toBe(200);

		// Protected path should require auth
		const res2 = await app.request("/admin/page");
		expect(res2.status).toBe(401);
	});

	test("ignores malformed lines without a password field", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "malformedlinewithoutcolon\nadmin:secret123",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		// The malformed entry is skipped, so only the valid credential works.
		const credentials = btoa("admin:secret123");
		const res = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${credentials}`,
			},
		});
		expect(res.status).toBe(200);

		// The malformed username cannot be used to authenticate.
		const badCredentials = btoa("malformedlinewithoutcolon:");
		const res2 = await app.request("/admin/dashboard", {
			headers: {
				Authorization: `Basic ${badCredentials}`,
			},
		});
		expect(res2.status).toBe(401);
	});

	test("skips authentication when htpasswd content is empty", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/admin/dashboard");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("skips authentication when htpasswd has only comments", async () => {
		const app = new Hono();
		const authMap = {
			"/admin": "# Comment only\n# Another comment",
		};
		applyBasicAuth(app, authMap);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/admin/dashboard");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});
