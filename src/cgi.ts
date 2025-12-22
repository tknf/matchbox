import { type Context, Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { getCookie, setCookie } from "hono/cookie";
import type { HtmlEscapedString } from "hono/utils/html";
import type { ContentfulStatusCode, RedirectStatusCode } from "hono/utils/http-status";
import packageJson from "../package.json";
import { generateCgiError, generateCgiInfo } from "./html";

// biome-ignore lint/suspicious/noExplicitAny: Child can be any
export type ConfigObject = Record<string, any>;

/**
 * --- Session Cookie Configuration ---
 */
export interface SessionCookieOptions {
	/** Session cookie name (default: "_SESSION_ID") */
	name?: string;
	/** Session cookie path (default: "/") */
	path?: string;
	/** Session cookie domain */
	domain?: string;
	/** Session cookie secure flag (default: false) */
	secure?: boolean;
	/** Session cookie SameSite attribute (default: "Lax") */
	sameSite?: "Strict" | "Lax" | "None";
	/** Session cookie max age in seconds */
	maxAge?: number;
}

/**
 * --- Matchbox Options ---
 */
export interface MatchboxOptions {
	/** Session cookie configuration */
	sessionCookie?: SessionCookieOptions;
	/** Enforce trailing slash on URLs */
	enforceTrailingSlash?: boolean;
	/** Custom middleware functions */
	middleware?: Array<(c: Context, next: () => Promise<void>) => Promise<Response | undefined>>;
	/** Custom logging function */
	logger?: (message: string, level?: "info" | "warn" | "error") => void;
}

/**
 * --- Module Information ---
 */
export interface ModuleInfo {
	/** URL path where the module is accessible */
	urlPath: string;
	/** Directory path for index modules, null otherwise */
	dirPath: string | null;
}

/**
 * --- Matchbox CGI Environment Types ---
 */
export interface CgiContext<ConfigType = ConfigObject> {
	$_GET: Record<string, string>;
	$_POST: Record<string, string>;
	$_FILES: Record<string, File | File[]>;
	// biome-ignore lint/suspicious/noExplicitAny: request can be any
	$_REQUEST: Record<string, any>;
	// biome-ignore lint/suspicious/noExplicitAny: session can be any
	$_SESSION: Record<string, any>;
	$_COOKIE: Record<string, string>;
	$_ENV: Record<string, string | undefined>;
	$_SERVER: {
		REQUEST_METHOD: string;
		REQUEST_URI: string;
		REMOTE_ADDR: string;
		USER_AGENT: string;
		SCRIPT_NAME: string;
		PATH_INFO: string;
		QUERY_STRING: string;
		// biome-ignore lint/suspicious/noExplicitAny: server vars can be any
		[key: string]: any;
	};
	config: ConfigType;
	c: Context;
	header: (name: string, value: string) => void;
	status: (code: number) => void;
	redirect: (url: string, status?: number) => { __type: "redirect"; url: string; status: number };
	cgiinfo: () => HtmlEscapedString | Promise<HtmlEscapedString>;
	request_headers: () => Record<string, string>;
	response_headers: () => Record<string, string>;
	log: (message: string) => void;
	get_version: () => string;
	/** Get list of all loaded CGI modules */
	get_modules: () => ModuleInfo[];
}

export type Page = {
	urlPath: string;
	dirPath: string | null;
	// biome-ignore lint/suspicious/noExplicitAny: handler output varies by Content-Type
	component: (context: CgiContext) => any | Promise<any>;
};

type RedirectRule = {
	type: "redirect";
	code: string;
	source: string;
	target: string;
};

type RewriteRule = {
	type: "rewrite";
	pattern: string;
	target: string;
	flags: string;
};

export type RewriteMap = Record<string, Array<RedirectRule | RewriteRule>>;

type RedirectObject = {
	__type: "redirect";
	url: string;
	status: number;
};

// biome-ignore lint/suspicious/noExplicitAny: redirect object check
const isRedirectObject = (obj: any): obj is RedirectObject => {
	return obj && obj.__type === "redirect" && typeof obj.url === "string";
};

/**
 * --- Matchbox Runtime Engine ---
 */
export const createCgiWithPages = (
	pages: Page[],
	siteConfig: ConfigObject = {},
	authMap: Record<string, string> = {},
	rewriteMap: RewriteMap = {},
	options: MatchboxOptions = {},
) => {
	const app = new Hono();
	const SESS_KEY = options.sessionCookie?.name || "_SESSION_ID";

	// Apply custom middleware if provided
	if (options.middleware && options.middleware.length > 0) {
		for (const mw of options.middleware) {
			app.use("*", async (c, next) => {
				const result = await mw(c, next);
				// If middleware returns a Response, return it immediately (early return)
				if (result instanceof Response) {
					return result;
				}
			});
		}
	}

	// Prevent access to sensitive configuration files
	const protectedFiles = [".htaccess", ".htpasswd", ".htdigest", ".htgroup"];
	app.use("*", async (c, next) => {
		const path = c.req.path;
		const lastSegment = path.slice(path.lastIndexOf("/") + 1);
		if (protectedFiles.some((file) => lastSegment === file)) {
			return c.text("Forbidden", 403);
		}
		await next();
	});

	// Enforce trailing slash if configured
	if (options.enforceTrailingSlash) {
		app.use("*", async (c, next) => {
			const path = c.req.path;
			if (!path.endsWith("/") && !path.includes(".")) {
				return c.redirect(`${path}/`, 301);
			}
			await next();
		});
	}

	// 1. Rewrite / Redirect Middleware
	Object.entries(rewriteMap).forEach(([dir, rules]) => {
		const basePath = dir === "/" ? "" : dir.replace(/\/$/, "");
		app.use(`${basePath}/*`, async (c, next) => {
			const relPath = c.req.path.replace(basePath, "") || "/";
			for (const rule of rules) {
				// Redirect Rule
				if (rule.type === "redirect") {
					if (relPath === rule.source) {
						return c.redirect(
							rule.target,
							(Number.parseInt(rule.code, 10) || 302) as RedirectStatusCode,
						);
					}
				}
				// Rewrite Rule
				else if (rule.type === "rewrite") {
					const regex = new RegExp(rule.pattern);
					if (regex.test(relPath)) {
						const target = rule.target.startsWith("/") ? rule.target : `${basePath}/${rule.target}`;
						if (rule.flags.includes("R")) {
							const code = rule.flags.match(/R=(\d+)/)?.[1] || "302";
							return c.redirect(target, Number.parseInt(code, 10) as RedirectStatusCode);
						}
					}
				}
			}
			await next();
		});
	});

	// 2. Basic Auth Middleware
	Object.entries(authMap).forEach(([dir, content]) => {
		const credentials = content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"))
			.map((line) => {
				const [username, password] = line.split(":");
				return { username, password };
			});
		if (credentials.length > 0) {
			const authPath = dir === "/" ? "*" : `${dir.replace(/\/$/, "")}/*`;
			app.use(authPath, async (c, next) => {
				const handler = basicAuth({
					verifyUser: (u, p) =>
						credentials.some((cred) => cred.username === u && cred.password === p),
					realm: "Restricted Area",
				});
				return handler(c, next);
			});
		}
	});

	// 3. Page Routing
	pages.forEach(({ urlPath, dirPath, component }) => {
		const routes = [urlPath, `${urlPath}/*`];
		if (dirPath) {
			routes.push(dirPath);
			if (dirPath !== "/") {
				routes.push(`${dirPath}/*`);
			}
		}

		routes.forEach((route) => {
			app.all(route, async (c) => {
				const $_GET = c.req.query();
				const body = await c.req.parseBody({ all: true }).catch(() => ({}));
				// biome-ignore lint/suspicious/noExplicitAny: body can be any
				const $_POST: Record<string, any> = {};
				const $_FILES: Record<string, File | File[]> = {};
				for (const [key, value] of Object.entries(body)) {
					if (value instanceof File || (Array.isArray(value) && value[0] instanceof File)) {
						$_FILES[key] = value as File | File[];
					} else {
						$_POST[key] = value;
					}
				}
				const $_COOKIE = getCookie(c);
				const $_REQUEST = {
					...$_COOKIE,
					...$_GET,
					...$_POST,
				};
				// biome-ignore lint/suspicious/noExplicitAny: environment can be any
				const $_ENV: Record<string, any> =
					typeof process !== "undefined" && process.env ? process.env : c.env || {};

				// biome-ignore lint/suspicious/noExplicitAny: session data can be any
				let $_SESSION: Record<string, any> = {};
				const sRaw = getCookie(c, SESS_KEY);
				if (sRaw) {
					try {
						$_SESSION = JSON.parse(decodeURIComponent(sRaw));
					} catch {}
				}

				let responseStatus = 200;
				const responseHeaders: Record<string, string> = {
					"Content-Type": "text/html; charset=utf-8",
				};

				const $_SERVER = {
					...$_ENV,
					REQUEST_METHOD: c.req.method,
					REQUEST_URI: c.req.url,
					REMOTE_ADDR: c.req.header("x-forwarded-for") || "127.0.0.1",
					USER_AGENT: c.req.header("user-agent") || "",
					SCRIPT_NAME: urlPath,
					PATH_INFO: c.req.path.replace(urlPath, "") || "/",
					QUERY_STRING: new URL(c.req.url).search.slice(1),
				};

				const cgiinfo = generateCgiInfo({
					$_SERVER,
					$_REQUEST,
					$_SESSION,
					config: siteConfig,
				});

				const context: CgiContext = {
					$_GET,
					$_POST,
					$_FILES,
					$_REQUEST,
					$_COOKIE,
					$_ENV,
					$_SERVER,
					$_SESSION,
					config: siteConfig,
					c,
					header: (name: string, value: string) => {
						responseHeaders[name.toLocaleLowerCase()] = value;
					},
					status: (code: number) => {
						(responseStatus as number) = code;
					},
					redirect: (url: string, status = 302) => {
						return { __type: "redirect", url, status };
					},
					cgiinfo,
					request_headers: () => {
						return Object.fromEntries(c.req.raw.headers.entries());
					},
					response_headers: () => {
						return responseHeaders;
					},
					log: (message: string) => {
						if (options.logger) {
							options.logger(message, "info");
						} else {
							console.log(`[CGI LOG] ${message}`);
						}
					},
					get_version: () => {
						return `MatchboxCGI/v${packageJson.version}`;
					},
					/**
					 * Returns information about all loaded CGI modules
					 * @returns Array of module information containing urlPath and dirPath
					 */
					get_modules: (): ModuleInfo[] => {
						return pages.map((page) => ({
							urlPath: page.urlPath,
							dirPath: page.dirPath,
						}));
					},
				};

				try {
					const result = await component(context);
					const sessionValue = encodeURIComponent(JSON.stringify($_SESSION));
					const sessionOptions: {
						path: string;
						httpOnly: boolean;
						sameSite: "Strict" | "Lax" | "None";
						secure?: boolean;
						domain?: string;
						maxAge?: number;
					} = {
						path: options.sessionCookie?.path || "/",
						httpOnly: true,
						sameSite: options.sessionCookie?.sameSite || "Lax",
					};

					if (options.sessionCookie?.secure !== undefined) {
						sessionOptions.secure = options.sessionCookie.secure;
					}
					if (options.sessionCookie?.domain) {
						sessionOptions.domain = options.sessionCookie.domain;
					}
					if (options.sessionCookie?.maxAge) {
						sessionOptions.maxAge = options.sessionCookie.maxAge;
					}

					// Redirect
					if (isRedirectObject(result)) {
						setCookie(c, SESS_KEY, sessionValue, sessionOptions);
						return c.redirect(result.url, result.status as RedirectStatusCode);
					}

					// Raw Response
					if (result instanceof Response) {
						setCookie(c, SESS_KEY, sessionValue, sessionOptions);
						return result;
					}

					// Set session cookie and custom headers
					setCookie(c, SESS_KEY, sessionValue, sessionOptions);
					Object.entries(responseHeaders).forEach(([key, value]) => {
						c.header(key, value);
					});

					// Determine response type based on Content-Type header or result type
					const contentType = responseHeaders["content-type"];

					// If Content-Type is explicitly set to JSON, return JSON
					if (contentType?.includes("application/json")) {
						return c.json(
							// biome-ignore lint/suspicious/noExplicitAny: to JSON response
							(result ?? { success: true }) as any,
							responseStatus as ContentfulStatusCode,
						);
					}

					// Default to HTML response
					return c.html(result, responseStatus as ContentfulStatusCode);

					// biome-ignore lint/suspicious/noExplicitAny: catch-all
				} catch (error: any) {
					return c.html(generateCgiError({ error, $_SERVER }), 500);
				}
			});
		});
	});

	return app;
};
