import { type Context, Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { getCookie, setCookie } from "hono/cookie";
import type {
	ContentfulStatusCode,
	RedirectStatusCode,
} from "hono/utils/http-status";
import { generateCgiError, generateCgiInfo } from "./html";

/**
 * --- Matchbox CGI Environment Types ---
 */
export interface CgiContext<ConfigType = any> {
	$_GET: Record<string, string>;
	$_POST: Record<string, string>;
	$_FILES: Record<string, File | File[]>;
	$_REQUEST: Record<string, any>;
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
		[key: string]: any;
	};
	config: ConfigType;
	c: Context;
	header: (name: string, value: string) => void;
	status: (code: number) => void;
	redirect: (
		url: string,
		status?: number,
	) => { __type: "redirect"; url: string; status: number };
	cgiinfo: () => any;
}

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

type RewriteMap = Record<string, Array<RedirectRule | RewriteRule>>;

type Page = {
	urlPath: string;
	dirPath: string | null;
	component: (ctx: CgiContext) => any;
};

/**
 * --- Matchbox Runtime Engine ---
 */
export const createCgi = (
	pages: Page[],
	siteConfig: any,
	authMap: Record<string, string> = {},
	rewriteMap: RewriteMap = {},
) => {
	const app = new Hono();
	const SESS_KEY = "_SESSION_ID";

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
						const target = rule.target.startsWith("/")
							? rule.target
							: `${basePath}/${rule.target}`;
						if (rule.flags.includes("R")) {
							const code = rule.flags.match(/R=(\d+)/)?.[1] || "302";
							return c.redirect(
								target,
								Number.parseInt(code, 10) as RedirectStatusCode,
							);
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
						credentials.some(
							(cred) => cred.username === u && cred.password === p,
						),
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
				const $_POST: Record<string, any> = {};
				const $_FILES: Record<string, File | File[]> = {};
				for (const [key, value] of Object.entries(body)) {
					if (
						value instanceof File ||
						(Array.isArray(value) && value[0] instanceof File)
					) {
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
				const $_ENV: Record<string, any> =
					typeof process !== "undefined" && process.env
						? process.env
						: c.env || {};

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
				};

				try {
					const result = await component(context);
					const sessionValue = encodeURIComponent(JSON.stringify($_SESSION));
					const sessionOptions = {
						path: "/",
						httpOnly: true,
						sameSite: "Lax" as const,
					};

					// Redirect
					if (result && result.__type === "redirect") {
						setCookie(c, SESS_KEY, sessionValue, sessionOptions);
						return c.redirect(result.url, result.status);
					}

					// Raw Response
					if (result instanceof Response) {
						setCookie(c, SESS_KEY, sessionValue, sessionOptions);
						return result;
					}

					// HTML Response
					setCookie(c, SESS_KEY, sessionValue, sessionOptions);
					Object.entries(responseHeaders).forEach(([key, value]) => {
						c.header(key, value);
					});
					if (typeof result === "string" || (result && result["__html"])) {
						return c.html(result, responseStatus as ContentfulStatusCode);
					}

					// JSON Response
					return c.json(
						result ?? { success: true },
						responseStatus as ContentfulStatusCode,
					);
				} catch (error: any) {
					return c.html(generateCgiError({ error, $_SERVER }), 500);
				}
			});
		});
	});

	return app;
};
