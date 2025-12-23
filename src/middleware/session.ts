import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { SessionCookieOptions } from "../cgi.js";

/**
 * Default session cookie name
 */
const DEFAULT_SESSION_COOKIE_NAME = "_SESSION_ID";

/**
 * Get session data from cookie
 */
export function getSessionFromCookie(
	c: Context,
	sessionCookieName?: string,
): Record<string, unknown> {
	const cookieName = sessionCookieName || DEFAULT_SESSION_COOKIE_NAME;
	const sessionCookie = getCookie(c, cookieName);

	if (sessionCookie) {
		try {
			return JSON.parse(decodeURIComponent(sessionCookie));
		} catch {
			return {};
		}
	}

	return {};
}

/**
 * Save session data to cookie
 */
export function saveSessionToCookie(
	c: Context,
	session: Record<string, unknown>,
	options?: SessionCookieOptions,
): void {
	const cookieName = options?.name || DEFAULT_SESSION_COOKIE_NAME;
	const sessionValue = encodeURIComponent(JSON.stringify(session));

	const sessionOptions: {
		path: string;
		httpOnly: boolean;
		sameSite: "Strict" | "Lax" | "None";
		secure?: boolean;
		domain?: string;
		maxAge?: number;
	} = {
		path: options?.path || "/",
		httpOnly: true,
		sameSite: options?.sameSite || "Lax",
	};

	if (options?.secure !== undefined) {
		sessionOptions.secure = options.secure;
	}
	if (options?.domain) {
		sessionOptions.domain = options.domain;
	}
	if (options?.maxAge !== undefined) {
		sessionOptions.maxAge = options.maxAge;
	}

	setCookie(c, cookieName, sessionValue, sessionOptions);
}
