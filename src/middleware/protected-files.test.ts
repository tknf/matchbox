import { describe, expect, test } from "vite-plus/test";
import { Hono } from "hono";
import { applyProtectedFilesMiddleware } from "./protected-files.js";

describe("applyProtectedFilesMiddleware", () => {
	test("blocks access to .htaccess files", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/.htaccess");
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("Forbidden");
	});

	test("blocks access to .htpasswd files", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/.htpasswd");
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("Forbidden");
	});

	test("blocks access to .htdigest files", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/.htdigest");
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("Forbidden");
	});

	test("blocks access to .htgroup files", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/.htgroup");
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("Forbidden");
	});

	test("blocks access to protected files in subdirectories", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/some/path/.htaccess");
		expect(res.status).toBe(403);
		expect(await res.text()).toBe("Forbidden");
	});

	test("allows access to normal files", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/index.html");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	test("allows access to files with protected names as substring", async () => {
		const app = new Hono();
		applyProtectedFilesMiddleware(app);
		app.get("*", (c) => c.text("OK", 200));

		const res = await app.request("/my-htaccess-backup.txt");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});
});
