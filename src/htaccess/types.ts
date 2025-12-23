import type { Context } from "hono";

/**
 * Main configuration type for .htaccess files (replaces RewriteMap)
 * Maps directory paths to their respective configurations
 */
export type HtaccessConfig = Record<string, DirectoryConfig>;

/**
 * Configuration for a single directory
 */
export interface DirectoryConfig {
	rewriteRules: RewriteRuleConfig[];
	redirects: RedirectConfig[];
	errorDocuments: ErrorDocumentConfig[];
	headers: HeaderConfig[];
	authConfig?: AuthConfig;
	accessControl?: AccessControlConfig;
}

/**
 * RewriteRule configuration
 */
export interface RewriteRuleConfig {
	type: "rewrite";
	pattern: string;
	target: string;
	flags: RewriteFlags;
	conditions: RewriteCondition[];
}

/**
 * RewriteCond configuration
 */
export interface RewriteCondition {
	testString: string; // e.g., %{HTTP_HOST}, %{REQUEST_URI}
	pattern: string; // regex pattern
	flags: ConditionFlags;
}

/**
 * RewriteRule flags
 */
export interface RewriteFlags {
	last?: boolean; // [L] - Last rule, stop processing
	redirect?: number; // [R] or [R=###] - Redirect with status code
	forbidden?: boolean; // [F] - Forbidden (403)
	gone?: boolean; // [G] - Gone (410)
	noCase?: boolean; // [NC] - No Case (case-insensitive matching)
	qsAppend?: boolean; // [QSA] - Query String Append
	qsDiscard?: boolean; // [QSD] - Query String Discard
	noEscape?: boolean; // [NE] - No Escape (don't encode special chars)
}

/**
 * RewriteCond flags
 */
export interface ConditionFlags {
	noCase?: boolean; // [NC] - No Case
	or?: boolean; // [OR] - OR with next condition (default is AND)
}

/**
 * ErrorDocument configuration
 */
export interface ErrorDocumentConfig {
	statusCode: number;
	target: string; // path or URL
}

/**
 * Header directive configuration
 */
export interface HeaderConfig {
	action: "set" | "append" | "unset";
	name: string;
	value?: string;
}

/**
 * Redirect configuration (legacy support)
 */
export interface RedirectConfig {
	type: "redirect";
	code: number;
	source: string;
	target: string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
	authType?: "Basic" | "Digest";
	authName?: string;
	authUserFile?: string;
	authGroupFile?: string;
	authDigestProvider?: string;
	require?: RequireConfig[];
}

/**
 * Require directive configuration
 */
export interface RequireConfig {
	type: "valid-user" | "user" | "group" | "ip" | "host" | "all";
	value?: string | string[]; // For user names, group names, IPs, or hosts
	granted?: boolean; // For "all granted" or "all denied"
}

/**
 * Access Control configuration (Apache 2.2 style - Order/Allow/Deny)
 */
export interface AccessControlConfig {
	order?: "allow,deny" | "deny,allow" | "mutual-failure";
	allow: AccessRule[];
	deny: AccessRule[];
}

/**
 * Access rule for Allow/Deny directives
 */
export interface AccessRule {
	type: "all" | "ip" | "host" | "env";
	value?: string | string[]; // IP addresses, hostnames, or environment variables
}

/**
 * Variable context for RewriteCond evaluation
 */
export interface VariableContext {
	HTTP_HOST: string;
	HTTP_USER_AGENT: string;
	REQUEST_URI: string;
	QUERY_STRING: string;
	HTTPS: string;
	REMOTE_ADDR: string;
	REQUEST_METHOD: string;
	HTTP_REFERER: string;
	HTTP_ACCEPT: string;
	HTTP_COOKIE: string;
	SERVER_NAME: string;
	SERVER_PORT: string;
	DOCUMENT_ROOT: string;
	REQUEST_FILENAME: string;
}

/**
 * Result of applying rewrite flags
 */
export type RewriteResult =
	| { type: "continue" }
	| { type: "redirect"; url: string; status: number }
	| { type: "forbidden" }
	| { type: "gone" }
	| { type: "rewrite"; path: string };

/**
 * Hono Context (for type compatibility)
 */
export type HonoContext = Context;
