import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { applyTrailingSlashMiddleware } from "./trailing-slash.js";

describe("applyTrailingSlashMiddleware", () => {
	test("redirects paths without trailing slash to paths with trailing slash", async () => {
		const app = new Hono();
		applyTrailingSlashMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/about", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/about/");
	});

	test("does not redirect paths that already have trailing slash", async () => {
		const app = new Hono();
		applyTrailingSlashMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/about/");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("does not redirect file paths with extensions", async () => {
		const app = new Hono();
		applyTrailingSlashMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/index.html");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("does not redirect paths with query strings and extensions", async () => {
		const app = new Hono();
		applyTrailingSlashMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/file.php?param=value");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("redirects nested paths without trailing slash", async () => {
		const app = new Hono();
		applyTrailingSlashMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/some/nested/path", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/some/nested/path/");
	});

	test("does not redirect root path", async () => {
		const app = new Hono();
		applyTrailingSlashMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});
