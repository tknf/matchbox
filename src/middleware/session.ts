import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { SessionCookieOptions } from "../cgi.js";

/**
 * Default session cookie name
 */
const DEFAULT_SESSION_COOKIE_NAME = "_SESSION_ID";

/**
 * Size (in bytes of the serialized cookie value) above which
 * `saveSessionToCookie` warns via the logger. Most browsers cap a single
 * cookie at 4096 bytes; 4000 leaves headroom for the cookie's own
 * name/attributes.
 */
const SESSION_COOKIE_SIZE_WARNING_THRESHOLD = 4000;

/** Logging function signature shared with `MatchboxOptions.logger`. */
type Logger = (message: string, level?: "info" | "warn" | "error") => void;

/**
 * Emits the "no sessionSecret configured" warning at most once per process,
 * regardless of how many requests/sessions trigger it.
 */
let warnedMissingSessionSecret = false;

const warnMissingSessionSecret = (logger?: Logger): void => {
	if (warnedMissingSessionSecret || !logger) return;
	warnedMissingSessionSecret = true;
	logger(
		"matchbox: sessionSecret is not configured. Session cookies are unsigned and can be read or " +
			"tampered with by the client. Set MatchboxOptions.sessionSecret in production.",
		"warn",
	);
};

const textEncoder = new TextEncoder();

/** Import a raw secret string as an HMAC-SHA256 Web Crypto key. */
const importHmacKey = (secret: string): Promise<CryptoKey> =>
	globalThis.crypto.subtle.importKey(
		"raw",
		textEncoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign", "verify"],
	);

/** Encode bytes as unpadded base64url, safe for direct use in a cookie value. */
const toBase64Url = (bytes: Uint8Array): string => {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Decode a base64url string (as produced by `toBase64Url`) back to bytes. */
const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> => {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
};

/** Sign `payload` (already base64url text) with HMAC-SHA256, returning base64url. */
const signPayload = async (payload: string, secret: string): Promise<string> => {
	const key = await importHmacKey(secret);
	const signature = await globalThis.crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
	return toBase64Url(new Uint8Array(signature));
};

/** Verify an HMAC-SHA256 signature (base64url) over `payload` (base64url text). */
const verifyPayload = async (
	payload: string,
	signatureB64Url: string,
	secret: string,
): Promise<boolean> => {
	const key = await importHmacKey(secret);
	try {
		return await globalThis.crypto.subtle.verify(
			"HMAC",
			key,
			fromBase64Url(signatureB64Url),
			textEncoder.encode(payload),
		);
	} catch {
		// Malformed base64url in the signature segment - treat as unverified.
		return false;
	}
};

/** Type guard for the decoded session payload: a plain JSON object. */
const isSessionRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Get session data from cookie.
 *
 * When `secret` is provided, the cookie is expected in the signed
 * `base64url(payload).base64url(hmac)` format produced by
 * `saveSessionToCookie`; a missing/invalid signature (including cookies
 * written before `sessionSecret` was configured) is treated as tampered and
 * yields an empty session rather than being parsed. When `secret` is
 * omitted, the cookie is read as the legacy unsigned URI-encoded JSON.
 */
export async function getSessionFromCookie(
	c: Context,
	sessionCookieName?: string,
	secret?: string,
	logger?: Logger,
): Promise<Record<string, unknown>> {
	const cookieName = sessionCookieName || DEFAULT_SESSION_COOKIE_NAME;
	const sessionCookie = getCookie(c, cookieName);

	if (!sessionCookie) return {};

	if (!secret) {
		warnMissingSessionSecret(logger);
		try {
			const parsed: unknown = JSON.parse(decodeURIComponent(sessionCookie));
			return isSessionRecord(parsed) ? parsed : {};
		} catch {
			return {};
		}
	}

	const separatorIndex = sessionCookie.lastIndexOf(".");
	if (separatorIndex === -1) return {};

	const payloadB64Url = sessionCookie.slice(0, separatorIndex);
	const signatureB64Url = sessionCookie.slice(separatorIndex + 1);

	const verified = await verifyPayload(payloadB64Url, signatureB64Url, secret);
	if (!verified) return {};

	try {
		const payloadJson = new TextDecoder().decode(fromBase64Url(payloadB64Url));
		const parsed: unknown = JSON.parse(payloadJson);
		return isSessionRecord(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

/**
 * Save session data to cookie.
 *
 * When `secret` is provided, the cookie value is
 * `base64url(payload) + "." + base64url(HMAC-SHA256(payload))` so a
 * tampered cookie fails verification on the next request (see
 * `getSessionFromCookie`). When omitted, the legacy unsigned URI-encoded
 * JSON format is used for backward compatibility.
 */
export async function saveSessionToCookie(
	c: Context,
	session: Record<string, unknown>,
	options?: SessionCookieOptions,
	secret?: string,
	logger?: Logger,
): Promise<void> {
	const cookieName = options?.name || DEFAULT_SESSION_COOKIE_NAME;
	const payload = JSON.stringify(session);

	let sessionValue: string;
	if (secret) {
		const payloadB64Url = toBase64Url(textEncoder.encode(payload));
		const signature = await signPayload(payloadB64Url, secret);
		sessionValue = `${payloadB64Url}.${signature}`;
	} else {
		warnMissingSessionSecret(logger);
		sessionValue = encodeURIComponent(payload);
	}

	if (sessionValue.length > SESSION_COOKIE_SIZE_WARNING_THRESHOLD) {
		logger?.(
			`matchbox: session cookie "${cookieName}" is ${sessionValue.length} bytes, exceeding the ` +
				`${SESSION_COOKIE_SIZE_WARNING_THRESHOLD}-byte guidance threshold. Browsers may reject or ` +
				"truncate large cookies - consider storing less data in $_SESSION.",
			"warn",
		);
	}

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
