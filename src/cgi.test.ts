import { describe, expect, test } from "vitest";
import { createCgiWithPages, type Page, type CgiContext } from "./cgi.js";
import { parseHtaccess } from "./htaccess/parser.js";
import type { HtaccessConfig } from "./htaccess/types.js";

type ProjectName = "basic" | "rewrite" | "auth" | "htaccess";

type LoadedProject = {
	pages: Page[];
	authMap: Record<string, string>;
	htaccessConfig: HtaccessConfig;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const loadProject = (project: ProjectName): LoadedProject => {
	let basePath = "";
	let modules: Record<string, unknown> = {};
	let urls: Record<string, string> = {};
	let htpasswds: Record<string, string> = {};
	let htaccessFiles: Record<string, string> = {};

	switch (project) {
		case "basic": {
			basePath = "/mocks/app-basic/public";
			modules = import.meta.glob("/mocks/app-basic/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
			});
			urls = import.meta.glob("/mocks/app-basic/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
				query: "?url",
				import: "default",
			});
			htpasswds = import.meta.glob("/mocks/app-basic/public/**/.htpasswd", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			htaccessFiles = import.meta.glob("/mocks/app-basic/public/**/.htaccess", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			break;
		}
		case "rewrite": {
			basePath = "/mocks/app-rewrite/public";
			modules = import.meta.glob("/mocks/app-rewrite/public/**/*.cgi.{tsx,jsx}", { eager: true });
			urls = import.meta.glob("/mocks/app-rewrite/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
				query: "?url",
				import: "default",
			});
			htpasswds = import.meta.glob("/mocks/app-rewrite/public/**/.htpasswd", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			htaccessFiles = import.meta.glob("/mocks/app-rewrite/public/**/.htaccess", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			break;
		}
		case "auth": {
			basePath = "/mocks/app-auth/public";
			modules = import.meta.glob("/mocks/app-auth/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
			});
			urls = import.meta.glob("/mocks/app-auth/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
				query: "?url",
				import: "default",
			});
			htpasswds = import.meta.glob("/mocks/app-auth/public/**/.htpasswd", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			htaccessFiles = import.meta.glob("/mocks/app-auth/public/**/.htaccess", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			break;
		}
		case "htaccess": {
			basePath = "/mocks/app-htaccess/public";
			modules = import.meta.glob("/mocks/app-htaccess/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
			});
			urls = import.meta.glob("/mocks/app-htaccess/public/**/*.cgi.{tsx,jsx}", {
				eager: true,
				query: "?url",
				import: "default",
			});
			htpasswds = import.meta.glob("/mocks/app-htaccess/public/**/.htpasswd", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			htaccessFiles = import.meta.glob("/mocks/app-htaccess/public/**/.htaccess", {
				eager: true,
				query: "?raw",
				import: "default",
			});
			break;
		}
	}

	const basePathRegex = new RegExp(`^${escapeRegex(basePath)}`);

	const pages = Object.keys(modules).map((key) => {
		const rawUrl = urls[key];
		const urlPath = rawUrl.replace(basePathRegex, "").replace(/.tsx$/, "").replace(/.jsx$/, "");
		const isIndex = urlPath.endsWith("/index.cgi") || urlPath === "/index.cgi";
		const dirPath = isIndex ? urlPath.replace(/\/index\.cgi$/, "/") : null;
		return { urlPath, dirPath, component: (modules[key] as any).default };
	});

	const authMap = Object.keys(htpasswds).reduce(
		(acc, key) => {
			const dir = key.replace(basePathRegex, "").replace(/\.htpasswd$/, "") || "/";
			acc[dir] = htpasswds[key];
			return acc;
		},
		{} as Record<string, string>,
	);

	const htaccessConfig = Object.keys(htaccessFiles).reduce((acc, key) => {
		const dir = key.replace(basePathRegex, "").replace(/\.htaccess$/, "") || "/";
		const content = htaccessFiles[key] as string;

		try {
			acc[dir] = parseHtaccess(content);
		} catch (error) {
			console.error(`Error parsing .htaccess in ${dir}:`, (error as Error).message);
			acc[dir] = {
				rewriteRules: [],
				redirects: [],
				errorDocuments: [],
				headers: [],
			};
		}

		return acc;
	}, {} as HtaccessConfig);

	return { pages, authMap, htaccessConfig };
};

const createApp = (project: ProjectName) => {
	const { pages, authMap, htaccessConfig } = loadProject(project);
	return createCgiWithPages(pages, {}, authMap, htaccessConfig);
};

describe("createCgi", () => {
	test("renders HTML string responses with headers and session cookie", async () => {
		const app = createApp("basic");

		const res = await app.request("/test.cgi");
		expect(res.status).toBe(201);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(res.headers.get("x-test")).toBe("ok");
		expect(res.headers.get("set-cookie")).toContain("_SESSION_ID=");
		const text = await res.text();
		expect(text).toBe("<h1>Hello String</h1>");
	});

	test("passes request data into CGI-like globals", async () => {
		const app = createApp("basic");

		const res = await app.request("/data.cgi?from=query", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Cookie: "token=abc",
			},
			body: new URLSearchParams({ from: "post" }),
		});

		const json = await res.json();
		expect(json.get).toEqual({ from: "query" });
		expect(json.post).toEqual({ from: "post" });
		expect(json.cookie).toEqual({ token: "abc" });
		expect(json.request).toMatchObject({
			from: "post",
			token: "abc",
		});
	});

	test("handles JSX-like element responses", async () => {
		const app = createApp("basic");

		const res = await app.request("/jsx.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	test("handles html tagged template responses", async () => {
		const app = createApp("basic");

		const res = await app.request("/html.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	test("keeps object responses as HTML when JSON header is not set", async () => {
		const app = createApp("basic");

		const res = await app.request("/object.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	test("returns JSON when Content-Type is forced", async () => {
		const app = createApp("basic");

		const res = await app.request("/json.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const json = await res.json();
		expect(json).toEqual({ data: "forced JSON" });
	});

	test("returns default JSON when handler returns undefined", async () => {
		const app = createApp("basic");

		const res = await app.request("/json-default.cgi");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ success: true });
	});

	test("returns a Response object verbatim", async () => {
		const app = createApp("basic");

		const res = await app.request("/response.cgi");
		expect(res.status).toBe(201);
		expect(res.headers.get("content-type")).toBe("text/plain");
		const text = await res.text();
		expect(text).toBe("Custom Response");
	});

	test("parses session cookies into $_SESSION", async () => {
		const app = createApp("basic");

		const sessionCookie = encodeURIComponent(JSON.stringify({ role: "admin" }));
		const res = await app.request("/session.cgi", {
			headers: { Cookie: `_SESSION_ID=${sessionCookie}` },
		});
		const json = await res.json();
		expect(json).toEqual({ role: "admin" });
	});

	test("uses c.env when process is unavailable", async () => {
		const originalProcess = globalThis.process;
		(globalThis as any).process = undefined;

		try {
			const app = createApp("basic");

			const res = await app.request("/env.cgi", {}, { KEY: "value" } as Record<string, unknown>);
			const json = await res.json();
			expect(json.KEY).toBe("value");
		} finally {
			(globalThis as any).process = originalProcess;
		}
	});

	test("falls back to empty env when process and c.env are missing", async () => {
		const originalProcess = globalThis.process;
		(globalThis as any).process = undefined;

		try {
			const app = createApp("basic");

			const res = await app.request(
				"/env-empty.cgi",
				{},
				null as unknown as Record<string, unknown>,
			);
			const json = await res.json();
			expect(json).toEqual({});
		} finally {
			(globalThis as any).process = originalProcess;
		}
	});

	test("handles redirect responses", async () => {
		const app = createApp("basic");

		const res = await app.request("/redirect.cgi", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/other");
	});

	test("routes requests via dirPath entries", async () => {
		const app = createApp("basic");

		const res = await app.request("/dir/");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe("dir-path");
	});

	test("redirects via rewrite rules", async () => {
		const app = createApp("rewrite");

		const redirectRes = await app.request("/old.cgi", { redirect: "manual" });
		expect(redirectRes.status).toBe(302);
		expect(redirectRes.headers.get("location")).toBe("/new");

		const rewriteRes = await app.request("/legacy.cgi", { redirect: "manual" });
		expect(rewriteRes.status).toBe(307);
		expect(rewriteRes.headers.get("location")).toBe("/fresh");
	});

	test("falls through when rewrite rules do not redirect", async () => {
		const app = createApp("rewrite");

		const res = await app.request("/no-redirect.cgi");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	test("falls through when redirect rules do not match", async () => {
		const app = createApp("rewrite");

		const res = await app.request("/stay.cgi");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("stay");
	});

	test("handles rewrite rules under nested base paths", async () => {
		const app = createApp("rewrite");

		const redirectRes = await app.request("/docs/", { redirect: "manual" });
		expect(redirectRes.status).toBe(302);
		expect(redirectRes.headers.get("location")).toBe("/moved");

		const rewriteRes = await app.request("/docs/legacy.cgi", {
			redirect: "manual",
		});
		expect(rewriteRes.status).toBe(302);
		expect(rewriteRes.headers.get("location")).toBe("/docs/rel-target");

		const fallthrough = await app.request("/docs/ok.cgi");
		expect(await fallthrough.text()).toBe("ok");
	});

	test("protects routes with basic auth", async () => {
		const app = createApp("auth");

		const unauthenticated = await app.request("/auth/secure.cgi");
		expect(unauthenticated.status).toBe(401);

		const credentials = Buffer.from("user:pass").toString("base64");
		const authenticated = await app.request("/auth/secure.cgi", {
			headers: { Authorization: `Basic ${credentials}` },
		});
		expect(authenticated.status).toBe(200);
	});

	test("skips auth middleware when credentials are empty", async () => {
		const app = createApp("auth");

		const res = await app.request("/empty/open.cgi");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("open");
	});

	test("applies basic auth to non-root directories", async () => {
		const app = createApp("auth");

		const unauthenticated = await app.request("/admin/page.cgi");
		expect(unauthenticated.status).toBe(401);
	});

	test("supports dirPath at the root", async () => {
		const app = createApp("basic");

		const res = await app.request("/");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("root-dir");
	});

	test("captures file uploads in $_FILES", async () => {
		const app = createApp("basic");

		const form = new FormData();
		form.append("upload", new File(["a"], "a.txt", { type: "text/plain" }));
		form.append("upload", new File(["b"], "b.txt", { type: "text/plain" }));
		form.append("note", "hello");

		const res = await app.request("/upload.cgi", {
			method: "POST",
			body: form,
		});
		const json = await res.json();
		expect(json.names).toEqual(["a.txt", "b.txt"]);
		expect(json.isArray).toBe(true);
		expect(json.postKeys).toEqual(["note"]);
	});

	test("falls back to empty body when parsing fails", async () => {
		const app = createApp("basic");

		const originalFormData = Request.prototype.formData;
		Request.prototype.formData = async () => {
			throw new Error("boom");
		};

		try {
			const req = new Request("http://localhost/bad-body.cgi", {
				method: "POST",
				headers: { "Content-Type": "multipart/form-data; boundary=oops" },
				body: "invalid",
			});

			const res = await app.fetch(req);

			const json = await res.json();
			expect(json).toEqual({});
		} finally {
			Request.prototype.formData = originalFormData;
		}
	});

	test("renders runtime errors as HTML", async () => {
		const app = createApp("basic");

		const res = await app.request("/boom.cgi");
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(text).toContain("Matchbox: Runtime Exception");
		expect(text).toContain("boom");
	});

	test("prevents access to .htaccess files", async () => {
		const app = createApp("basic");

		const res = await app.request("/.htaccess");
		expect(res.status).toBe(403);
		const text = await res.text();
		expect(text).toBe("Forbidden");
	});

	test("prevents access to .htpasswd files", async () => {
		const app = createApp("basic");

		const res = await app.request("/admin/.htpasswd");
		expect(res.status).toBe(403);
		const text = await res.text();
		expect(text).toBe("Forbidden");
	});

	test("allows access to files containing protected filenames in their name", async () => {
		const app = createApp("basic");

		// These should NOT be blocked - they just contain the protected filename
		const res1 = await app.request("/myfile.htaccess");
		expect(res1.status).not.toBe(403);

		const res2 = await app.request("/.htaccess.backup");
		expect(res2.status).not.toBe(403);
	});

	test("prevents access to protected files in nested paths", async () => {
		const app = createApp("basic");

		const res1 = await app.request("/deeply/nested/path/.htaccess");
		expect(res1.status).toBe(403);

		const res2 = await app.request("/admin/config/.htpasswd");
		expect(res2.status).toBe(403);

		const res3 = await app.request("/auth/.htdigest");
		expect(res3.status).toBe(403);

		const res4 = await app.request("/groups/.htgroup");
		expect(res4.status).toBe(403);
	});

	test("supports custom session cookie name", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			sessionCookie: {
				name: "_CUSTOM_SESSION",
			},
		});

		const res = await app.request("/test.cgi");
		expect(res.status).toBe(201);
		expect(res.headers.get("set-cookie")).toContain("_CUSTOM_SESSION=");
		expect(res.headers.get("set-cookie")).not.toContain("_SESSION_ID=");
	});

	test("supports custom session cookie options", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			sessionCookie: {
				path: "/admin",
				sameSite: "Strict",
				secure: true,
				maxAge: 3600,
			},
		});

		const res = await app.request("/test.cgi");
		const cookie = res.headers.get("set-cookie");
		expect(cookie).toContain("Path=/admin");
		expect(cookie).toContain("SameSite=Strict");
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("Max-Age=3600");
	});

	test("supports custom middleware", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			middleware: [
				async (c, next) => {
					c.header("X-Custom-Header", "test-value");
					await next();
					return undefined;
				},
			],
		});

		const res = await app.request("/test.cgi");
		expect(res.headers.get("X-Custom-Header")).toBe("test-value");
	});

	test("supports custom logger", async () => {
		const logs: string[] = [];
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			logger: (message) => {
				logs.push(message);
			},
		});

		await app.request("/logger.cgi");

		expect(logs.length).toBe(1);
		expect(logs[0]).toBe("Test log message");
	});

	test("returns module list from get_modules", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");

		// Create a test page that uses get_modules
		const testPages = [
			...pages,
			{
				urlPath: "/modules.cgi",
				dirPath: null,
				component: (ctx: CgiContext) => {
					ctx.header("Content-Type", "application/json");
					return ctx.get_modules();
				},
			},
		];

		const testApp = createCgiWithPages(testPages, {}, authMap, htaccessConfig);
		const res = await testApp.request("/modules.cgi");
		const json = await res.json();
		expect(Array.isArray(json)).toBe(true);
		expect(json.length).toBeGreaterThan(0);
		expect(json[0]).toHaveProperty("urlPath");
	});

	test("enforces trailing slash when configured", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			enforceTrailingSlash: true,
		});

		const res = await app.request("/dir", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/dir/");
	});

	test("does not redirect paths with dots when trailing slash is enforced", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			enforceTrailingSlash: true,
		});

		// Should not redirect file-like paths
		const res = await app.request("/test.cgi");
		expect(res.status).not.toBe(301);
	});

	test("does not redirect paths with version numbers when trailing slash is enforced", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			enforceTrailingSlash: true,
		});

		// Paths like /api/v1.0 should not be redirected
		const res = await app.request("/api/v1.0/users", { redirect: "manual" });
		// This will 404 because the path doesn't exist, but shouldn't redirect
		expect(res.status).not.toBe(301);
	});

	test("does not redirect paths that already have trailing slash", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			enforceTrailingSlash: true,
		});

		const res = await app.request("/dir/", { redirect: "manual" });
		expect(res.status).not.toBe(301);
	});

	test("supports middleware with early return", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("basic");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig, {
			middleware: [
				async (c) => {
					// Middleware returns Response directly (early return)
					if (c.req.path === "/early-return") {
						return new Response("Early return", { status: 200 });
					}
				},
			],
		});

		const res = await app.request("/early-return");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe("Early return");
	});
});

describe("Access Control (Order/Allow/Deny)", () => {
	test("should deny access when 'Deny from all' is set", async () => {
		const { pages, authMap, htaccessConfig } = loadProject("htaccess");
		const app = createCgiWithPages(pages, {}, authMap, htaccessConfig);

		const res = await app.request("/access-test/");
		expect(res.status).toBe(403);
		const text = await res.text();
		expect(text).toBe("Forbidden");
	});
});
