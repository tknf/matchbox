import { type Context, Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { HtmlEscapedString } from "hono/utils/html";
import type { ContentfulStatusCode, RedirectStatusCode } from "hono/utils/http-status";
import { generateCgiError, generateCgiInfo } from "./html.js";
import type { HtaccessConfig } from "./htaccess/types.js";
import {
	applyBasicAuth,
	applyHtaccessMiddleware,
	applyErrorDocumentMiddleware,
	getSessionFromCookie,
	saveSessionToCookie,
	applyProtectedFilesMiddleware,
	applyTrailingSlashMiddleware,
} from "./middleware/index.js";

declare const __version__: string;

export type ConfigObject = Record<string, unknown>;

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
	$_REQUEST: Record<string, unknown>;
	$_SESSION: Record<string, unknown>;
	$_COOKIE: Record<string, string>;
	$_ENV: Record<string, unknown>;
	$_SERVER: {
		REQUEST_METHOD: string;
		REQUEST_URI: string;
		REMOTE_ADDR: string;
		USER_AGENT: string;
		SCRIPT_NAME: string;
		PATH_INFO: string;
		QUERY_STRING: string;
		[key: string]: unknown;
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
	component: (context: CgiContext) => unknown | Promise<unknown>;
};

// Legacy types removed - now using HtaccessConfig from htaccess module
export type { HtaccessConfig } from "./htaccess/types.js";

type RedirectObject = {
	__type: "redirect";
	url: string;
	status: number;
};

const isRedirectObject = (obj: unknown): obj is RedirectObject => {
	return (
		typeof obj === "object" &&
		obj !== null &&
		"__type" in obj &&
		obj.__type === "redirect" &&
		"url" in obj &&
		typeof obj.url === "string"
	);
};

/**
 * --- Matchbox Runtime Engine ---
 */
export const createCgiWithPages = (
	pages: Page[],
	siteConfig: ConfigObject = {},
	authMap: Record<string, string> = {},
	htaccessConfig: HtaccessConfig = {},
	options: MatchboxOptions = {},
) => {
	const app = new Hono();

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
	applyProtectedFilesMiddleware(app);

	// Enforce trailing slash if configured
	if (options.enforceTrailingSlash) {
		applyTrailingSlashMiddleware(app);
	}

	// Apply htaccess middleware (headers, rewrite, access control)
	applyHtaccessMiddleware(app, htaccessConfig);

	// Apply Basic Auth middleware
	applyBasicAuth(app, authMap);

	// 4. Page Routing
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
				const $_POST: Record<string, string> = {};
				const $_FILES: Record<string, File | File[]> = {};
				for (const [key, value] of Object.entries(body)) {
					if (value instanceof File || (Array.isArray(value) && value[0] instanceof File)) {
						$_FILES[key] = value as File | File[];
					} else {
						$_POST[key] = String(value);
					}
				}
				const $_COOKIE = getCookie(c);
				const $_REQUEST = {
					...$_COOKIE,
					...$_GET,
					...$_POST,
				};
				const $_ENV: Record<string, unknown> = (
					typeof process !== "undefined" && process.env ? process.env : c.env || {}
				) as Record<string, unknown>;

				let $_SESSION: Record<string, unknown> = getSessionFromCookie(
					c,
					options.sessionCookie?.name,
				);

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
						return `MatchboxCGI/v${__version__}`;
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

					// Save session to cookie
					saveSessionToCookie(c, $_SESSION, options.sessionCookie);

					// Redirect
					if (isRedirectObject(result)) {
						return c.redirect(result.url, result.status as RedirectStatusCode);
					}

					// Raw Response
					if (result instanceof Response) {
						return result;
					}

					// Set custom headers
					Object.entries(responseHeaders).forEach(([key, value]) => {
						c.header(key, value);
					});

					// Determine response type based on Content-Type header or result type
					const contentType = responseHeaders["content-type"];

					// If Content-Type is explicitly set to JSON, return JSON
					if (contentType?.includes("application/json")) {
						return c.json(result ?? { success: true }, responseStatus as ContentfulStatusCode);
					}

					// Default to HTML response
					return c.html(String(result ?? ""), responseStatus as ContentfulStatusCode);
				} catch (error: unknown) {
					return c.html(generateCgiError({ error, $_SERVER }), 500);
				}
			});
		});
	});

	// Apply error document middleware (runs last, after everything)
	applyErrorDocumentMiddleware(app, htaccessConfig);

	return app;
};
