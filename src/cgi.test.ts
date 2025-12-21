import { describe, expect, it } from "vitest";
import { createCgiWithPages, type RewriteMap } from "./cgi";

type ProjectName = "basic" | "rewrite" | "auth";

type LoadedProject = {
	pages: Array<{ urlPath: string; dirPath: string | null; component: any }>;
	authMap: Record<string, string>;
	rewriteMap: RewriteMap;
};

const escapeRegex = (value: string) =>
	value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const loadProject = (project: ProjectName): LoadedProject => {
	let basePath = "";
	let modules: Record<string, any> = {};
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
			modules = import.meta.glob(
				"/mocks/app-rewrite/public/**/*.cgi.{tsx,jsx}",
				{ eager: true },
			);
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
			htaccessFiles = import.meta.glob(
				"/mocks/app-rewrite/public/**/.htaccess",
				{
					eager: true,
					query: "?raw",
					import: "default",
				},
			);
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
	}

	const basePathRegex = new RegExp(`^${escapeRegex(basePath)}`);

	const pages = Object.keys(modules).map((key) => {
		const rawUrl = urls[key];
		const urlPath = rawUrl
			.replace(basePathRegex, "")
			.replace(/.tsx$/, "")
			.replace(/.jsx$/, "");
		const isIndex = urlPath.endsWith("/index.cgi") || urlPath === "/index.cgi";
		const dirPath = isIndex ? urlPath.replace(/\/index\.cgi$/, "/") : null;
		return { urlPath, dirPath, component: modules[key].default };
	});

	const authMap = Object.keys(htpasswds).reduce(
		(acc, key) => {
			const dir =
				key.replace(basePathRegex, "").replace(/\.htpasswd$/, "") || "/";
			acc[dir] = htpasswds[key];
			return acc;
		},
		{} as Record<string, string>,
	);

	const rewriteMap = Object.keys(htaccessFiles).reduce((acc, key) => {
		const dir =
			key.replace(basePathRegex, "").replace(/\.htaccess$/, "") || "/";
		const lines = htaccessFiles[key].split("\n");
		const rules = lines
			.map((line) => {
				const l = line.trim();
				if (!l || l.startsWith("#")) return null;
				const parts = l.split(/\s+/);
				if (parts[0] === "RewriteRule") {
					return {
						type: "rewrite",
						pattern: parts[1],
						target: parts[2],
						flags: parts[3] || "",
					} as RewriteMap[string][number];
				}
				if (parts[0] === "Redirect") {
					return {
						type: "redirect",
						code: parts[1],
						source: parts[2],
						target: parts[3],
					} as RewriteMap[string][number];
				}
				return null;
			})
			.filter((rule): rule is RewriteMap[string][number] => rule !== null);
		acc[dir] = rules;
		return acc;
	}, {} as RewriteMap);

	return { pages, authMap, rewriteMap };
};

const createApp = (project: ProjectName) => {
	const { pages, authMap, rewriteMap } = loadProject(project);
	return createCgiWithPages(pages, {}, authMap, rewriteMap);
};

describe("createCgi", () => {
	it("renders HTML string responses with headers and session cookie", async () => {
		const app = createApp("basic");

		const res = await app.request("/test.cgi");
		expect(res.status).toBe(201);
		expect(res.headers.get("content-type")).toContain("text/html");
		expect(res.headers.get("x-test")).toBe("ok");
		expect(res.headers.get("set-cookie")).toContain("_SESSION_ID=");
		const text = await res.text();
		expect(text).toBe("<h1>Hello String</h1>");
	});

	it("passes request data into CGI-like globals", async () => {
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

	it("handles JSX-like element responses", async () => {
		const app = createApp("basic");

		const res = await app.request("/jsx.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("handles html tagged template responses", async () => {
		const app = createApp("basic");

		const res = await app.request("/html.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("keeps object responses as HTML when JSON header is not set", async () => {
		const app = createApp("basic");

		const res = await app.request("/object.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("text/html");
	});

	it("returns JSON when Content-Type is forced", async () => {
		const app = createApp("basic");

		const res = await app.request("/json.cgi");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toContain("application/json");
		const json = await res.json();
		expect(json).toEqual({ data: "forced JSON" });
	});

	it("returns default JSON when handler returns undefined", async () => {
		const app = createApp("basic");

		const res = await app.request("/json-default.cgi");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ success: true });
	});

	it("returns a Response object verbatim", async () => {
		const app = createApp("basic");

		const res = await app.request("/response.cgi");
		expect(res.status).toBe(201);
		expect(res.headers.get("content-type")).toBe("text/plain");
		const text = await res.text();
		expect(text).toBe("Custom Response");
	});

	it("parses session cookies into $_SESSION", async () => {
		const app = createApp("basic");

		const sessionCookie = encodeURIComponent(JSON.stringify({ role: "admin" }));
		const res = await app.request("/session.cgi", {
			headers: { Cookie: `_SESSION_ID=${sessionCookie}` },
		});
		const json = await res.json();
		expect(json).toEqual({ role: "admin" });
	});

	it("uses c.env when process is unavailable", async () => {
		const originalProcess = (
			globalThis as typeof globalThis & {
				process?: NodeJS.Process;
			}
		).process;
		(globalThis as any).process = undefined;

		try {
			const app = createApp("basic");

			const res = await app.request("/env.cgi", {}, { KEY: "value" } as any);
			const json = await res.json();
			expect(json.KEY).toBe("value");
		} finally {
			(globalThis as any).process = originalProcess;
		}
	});

	it("falls back to empty env when process and c.env are missing", async () => {
		const originalProcess = (
			globalThis as typeof globalThis & {
				process?: NodeJS.Process;
			}
		).process;
		(globalThis as any).process = undefined;

		try {
			const app = createApp("basic");

			const res = await app.request("/env-empty.cgi", {}, null as any);
			const json = await res.json();
			expect(json).toEqual({});
		} finally {
			(globalThis as any).process = originalProcess;
		}
	});

	it("handles redirect responses", async () => {
		const app = createApp("basic");

		const res = await app.request("/redirect.cgi", { redirect: "manual" });
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("/other");
	});

	it("routes requests via dirPath entries", async () => {
		const app = createApp("basic");

		const res = await app.request("/dir/");
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toBe("dir-path");
	});

	it("redirects via rewrite rules", async () => {
		const app = createApp("rewrite");

		const redirectRes = await app.request("/old.cgi", { redirect: "manual" });
		expect(redirectRes.status).toBe(302);
		expect(redirectRes.headers.get("location")).toBe("/new");

		const rewriteRes = await app.request("/legacy.cgi", { redirect: "manual" });
		expect(rewriteRes.status).toBe(307);
		expect(rewriteRes.headers.get("location")).toBe("/fresh");
	});

	it("falls through when rewrite rules do not redirect", async () => {
		const app = createApp("rewrite");

		const res = await app.request("/no-redirect.cgi");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("ok");
	});

	it("falls through when redirect rules do not match", async () => {
		const app = createApp("rewrite");

		const res = await app.request("/stay.cgi");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("stay");
	});

	it("handles rewrite rules under nested base paths", async () => {
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

	it("protects routes with basic auth", async () => {
		const app = createApp("auth");

		const unauthenticated = await app.request("/auth/secure.cgi");
		expect(unauthenticated.status).toBe(401);

		const credentials = Buffer.from("user:pass").toString("base64");
		const authenticated = await app.request("/auth/secure.cgi", {
			headers: { Authorization: `Basic ${credentials}` },
		});
		expect(authenticated.status).toBe(200);
	});

	it("skips auth middleware when credentials are empty", async () => {
		const app = createApp("auth");

		const res = await app.request("/empty/open.cgi");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("open");
	});

	it("applies basic auth to non-root directories", async () => {
		const app = createApp("auth");

		const unauthenticated = await app.request("/admin/page.cgi");
		expect(unauthenticated.status).toBe(401);
	});

	it("supports dirPath at the root", async () => {
		const app = createApp("basic");

		const res = await app.request("/");
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("root-dir");
	});

	it("captures file uploads in $_FILES", async () => {
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

	it("falls back to empty body when parsing fails", async () => {
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

	it("renders runtime errors as HTML", async () => {
		const app = createApp("basic");

		const res = await app.request("/boom.cgi");
		expect(res.status).toBe(500);
		const text = await res.text();
		expect(text).toContain("Matchbox: Runtime Exception");
		expect(text).toContain("boom");
	});
});
