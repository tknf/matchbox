import type {
	AccessRule,
	ConditionFlags,
	DirectoryConfig,
	ErrorDocumentConfig,
	HeaderConfig,
	RedirectConfig,
	RequireConfig,
	RewriteCondition,
	RewriteFlags,
	RewriteRuleConfig,
} from "./types.js";

/**
 * Tokenize a line, handling quoted strings and escape sequences
 */
function tokenize(line: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let inQuotes = false;
	let quoteChar = "";
	let escaped = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (escaped) {
			current += char;
			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		if ((char === '"' || char === "'") && !inQuotes) {
			inQuotes = true;
			quoteChar = char;
			continue;
		}

		if (char === quoteChar && inQuotes) {
			inQuotes = false;
			tokens.push(current);
			current = "";
			quoteChar = "";
			continue;
		}

		if (/\s/.test(char) && !inQuotes) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}

		current += char;
	}

	if (current) tokens.push(current);
	return tokens;
}

/**
 * Parse RewriteRule flags from string like "[L,NC,R=301]" or "R=307" (legacy format)
 */
function parseRewriteFlags(flagString: string): RewriteFlags {
	const flags: RewriteFlags = {};

	// Remove brackets: [L,NC,R=301] -> L,NC,R=301 (supports both bracketed and unbracketed)
	const cleaned = flagString.replace(/^\[|\]$/g, "").trim();
	if (!cleaned) return flags;

	// Split by comma or space for backward compatibility
	// Old format: "R=307" or "L NC"
	// New format: "[L,NC,R=301]"
	const parts = cleaned.includes(",") ? cleaned.split(",") : cleaned.split(/\s+/);

	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) continue;

		if (trimmed === "L") flags.last = true;
		else if (trimmed === "NC") flags.noCase = true;
		else if (trimmed === "QSA") flags.qsAppend = true;
		else if (trimmed === "QSD") flags.qsDiscard = true;
		else if (trimmed === "NE") flags.noEscape = true;
		else if (trimmed === "F") flags.forbidden = true;
		else if (trimmed === "G") flags.gone = true;
		else if (trimmed === "R" || trimmed.startsWith("R=")) {
			const match = trimmed.match(/^R(?:=(\d+))?$/);
			flags.redirect = match?.[1] ? Number.parseInt(match[1], 10) : 302;
		}
	}

	return flags;
}

/**
 * Parse RewriteCond flags from string like "[NC,OR]"
 */
function parseConditionFlags(flagString: string): ConditionFlags {
	const flags: ConditionFlags = {};

	const cleaned = flagString.replace(/^\[|\]$/g, "");
	if (!cleaned) return flags;

	const parts = cleaned.split(",");

	for (const part of parts) {
		const trimmed = part.trim();
		if (trimmed === "NC") flags.noCase = true;
		else if (trimmed === "OR") flags.or = true;
	}

	return flags;
}

/**
 * Parse RewriteCond directive
 * Format: RewriteCond TestString Pattern [Flags]
 */
function parseRewriteCond(tokens: string[]): RewriteCondition {
	if (tokens.length < 3) {
		throw new Error("RewriteCond requires at least 2 arguments");
	}

	return {
		testString: tokens[1],
		pattern: tokens[2],
		flags: parseConditionFlags(tokens[3] || ""),
	};
}

/**
 * Parse RewriteRule directive
 * Format: RewriteRule Pattern Target [Flags]
 */
function parseRewriteRule(tokens: string[]): RewriteRuleConfig {
	if (tokens.length < 3) {
		throw new Error("RewriteRule requires at least 2 arguments");
	}

	return {
		type: "rewrite",
		pattern: tokens[1],
		target: tokens[2],
		flags: parseRewriteFlags(tokens[3] || ""),
		conditions: [], // Will be populated by main parser
	};
}

/**
 * Parse ErrorDocument directive
 * Format: ErrorDocument statusCode target
 */
function parseErrorDocument(tokens: string[]): ErrorDocumentConfig {
	if (tokens.length < 3) {
		throw new Error("ErrorDocument requires status code and target");
	}

	const statusCode = Number.parseInt(tokens[1], 10);
	if (Number.isNaN(statusCode) || statusCode < 100 || statusCode >= 600) {
		throw new Error(`Invalid status code: ${tokens[1]}`);
	}

	return {
		statusCode,
		target: tokens[2],
	};
}

/**
 * Parse Header directive
 * Format: Header set|append|unset name [value]
 */
function parseHeader(tokens: string[]): HeaderConfig {
	if (tokens.length < 3) {
		throw new Error("Header requires action and name");
	}

	const action = tokens[1].toLowerCase();
	if (!["set", "append", "unset"].includes(action)) {
		throw new Error(`Invalid header action: ${action}`);
	}

	return {
		action: action as "set" | "append" | "unset",
		name: tokens[2],
		value: tokens[3] || undefined,
	};
}

/**
 * Parse Redirect directive
 * Format: Redirect [status] source target
 *         RedirectPermanent source target
 *         RedirectTemp source target
 */
function parseRedirect(tokens: string[], directive: string): RedirectConfig {
	let code = 302;
	let sourceIdx = 1;

	if (directive === "RedirectPermanent") {
		code = 301;
	} else if (directive === "RedirectTemp") {
		code = 302;
	} else if (directive === "Redirect") {
		// If there are 4 tokens (directive + 3 args), assume format: Redirect [code] source target
		// Even if code is invalid, treat first arg as status code and skip it
		if (tokens.length === 4) {
			const maybeCode = Number.parseInt(tokens[1], 10);
			code = !Number.isNaN(maybeCode) ? maybeCode : 302;
			sourceIdx = 2;
		}
		// If there are 3 tokens (directive + 2 args), it's: Redirect source target
		// sourceIdx stays at 1, code stays at default 302
	}

	if (tokens.length < sourceIdx + 2) {
		throw new Error(`${directive} requires source and target paths`);
	}

	return {
		type: "redirect",
		code,
		source: tokens[sourceIdx],
		target: tokens[sourceIdx + 1],
	};
}

/**
 * Parse AuthType directive
 */
function parseAuthType(tokens: string[]): "Basic" | "Digest" {
	if (tokens.length < 2) {
		throw new Error("AuthType requires a type (Basic or Digest)");
	}

	const type = tokens[1];
	if (type !== "Basic" && type !== "Digest") {
		throw new Error(`Invalid AuthType: ${type}. Must be Basic or Digest`);
	}

	return type;
}

/**
 * Parse Require directive
 */
function parseRequire(tokens: string[]): RequireConfig {
	if (tokens.length < 2) {
		throw new Error("Require directive requires at least one argument");
	}

	const type = tokens[1];

	// Require valid-user
	if (type === "valid-user") {
		return { type: "valid-user" };
	}

	// Require all granted|denied
	if (type === "all") {
		if (tokens.length < 3) {
			throw new Error("Require all must specify granted or denied");
		}
		const granted = tokens[2] === "granted";
		return { type: "all", granted };
	}

	// Require user username1 username2 ...
	if (type === "user") {
		if (tokens.length < 3) {
			throw new Error("Require user must specify at least one username");
		}
		return { type: "user", value: tokens.slice(2) };
	}

	// Require group groupname1 groupname2 ...
	if (type === "group") {
		if (tokens.length < 3) {
			throw new Error("Require group must specify at least one group name");
		}
		return { type: "group", value: tokens.slice(2) };
	}

	// Require ip 192.168.1.0/24
	if (type === "ip") {
		if (tokens.length < 3) {
			throw new Error("Require ip must specify at least one IP or CIDR");
		}
		return { type: "ip", value: tokens.slice(2) };
	}

	// Require host example.com
	if (type === "host") {
		if (tokens.length < 3) {
			throw new Error("Require host must specify at least one hostname");
		}
		return { type: "host", value: tokens.slice(2) };
	}

	throw new Error(`Unknown Require type: ${type}`);
}

/**
 * Parse Allow/Deny directives (Apache 2.2 style)
 */
function parseAccessRule(tokens: string[]): AccessRule {
	if (tokens.length < 3) {
		throw new Error(`${tokens[0]} directive requires at least one argument`);
	}

	const fromKeyword = tokens[1];
	if (fromKeyword !== "from") {
		throw new Error(`${tokens[0]} directive must use 'from' keyword`);
	}

	const target = tokens[2];

	// Allow from all / Deny from all
	if (target === "all") {
		return { type: "all" };
	}

	// Allow from env=VARIABLE
	if (target.startsWith("env=")) {
		return { type: "env", value: target.slice(4) };
	}

	// Check if it looks like an IP address or CIDR
	const isIP = /^[\d./]+$/.test(target) || target.includes(":");
	if (isIP) {
		// Allow from 192.168.1.0/24 or multiple IPs
		return { type: "ip", value: tokens.slice(2) };
	}

	// Otherwise treat as hostname
	return { type: "host", value: tokens.slice(2) };
}

/**
 * Main parser for .htaccess files
 */
export function parseHtaccess(content: string): DirectoryConfig {
	const config: DirectoryConfig = {
		rewriteRules: [],
		redirects: [],
		errorDocuments: [],
		headers: [],
		authConfig: undefined,
		accessControl: undefined,
	};

	const lines = content.split("\n");
	const pendingConditions: RewriteCondition[] = [];
	let multiLineBuffer = "";

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i].trim();

		// Skip comments and empty lines
		if (!line || line.startsWith("#")) continue;

		// Handle multi-line continuation
		if (line.endsWith("\\")) {
			multiLineBuffer += line.slice(0, -1) + " ";
			continue;
		}

		if (multiLineBuffer) {
			line = multiLineBuffer + line;
			multiLineBuffer = "";
		}

		const tokens = tokenize(line);
		if (tokens.length === 0) continue;

		const directive = tokens[0];

		try {
			switch (directive) {
				case "RewriteCond":
					pendingConditions.push(parseRewriteCond(tokens));
					break;

				case "RewriteRule": {
					const rule = parseRewriteRule(tokens);
					rule.conditions = [...pendingConditions];
					config.rewriteRules.push(rule);
					pendingConditions.length = 0; // Clear for next rule
					break;
				}

				case "Redirect":
				case "RedirectPermanent":
				case "RedirectTemp":
					config.redirects.push(parseRedirect(tokens, directive));
					pendingConditions.length = 0; // Clear orphaned conditions
					break;

				case "ErrorDocument":
					config.errorDocuments.push(parseErrorDocument(tokens));
					break;

				case "Header":
					config.headers.push(parseHeader(tokens));
					break;

				case "AuthType":
					if (!config.authConfig) {
						config.authConfig = {};
					}
					config.authConfig.authType = parseAuthType(tokens);
					break;

				case "AuthName":
					if (!config.authConfig) {
						config.authConfig = {};
					}
					if (tokens.length < 2) {
						throw new Error("AuthName requires a realm name");
					}
					config.authConfig.authName = tokens.slice(1).join(" ");
					break;

				case "AuthUserFile":
					if (!config.authConfig) {
						config.authConfig = {};
					}
					if (tokens.length < 2) {
						throw new Error("AuthUserFile requires a file path");
					}
					config.authConfig.authUserFile = tokens[1];
					break;

				case "AuthGroupFile":
					if (!config.authConfig) {
						config.authConfig = {};
					}
					if (tokens.length < 2) {
						throw new Error("AuthGroupFile requires a file path");
					}
					config.authConfig.authGroupFile = tokens[1];
					break;

				case "AuthDigestProvider":
					if (!config.authConfig) {
						config.authConfig = {};
					}
					if (tokens.length < 2) {
						throw new Error("AuthDigestProvider requires a provider name");
					}
					config.authConfig.authDigestProvider = tokens[1];
					break;

				case "Require":
					if (!config.authConfig) {
						config.authConfig = {};
					}
					if (!config.authConfig.require) {
						config.authConfig.require = [];
					}
					config.authConfig.require.push(parseRequire(tokens));
					break;

				case "Order": {
					if (!config.accessControl) {
						config.accessControl = { allow: [], deny: [] };
					}
					if (tokens.length < 2) {
						throw new Error("Order directive requires an argument");
					}
					const orderValue = tokens[1].toLowerCase();
					if (
						orderValue !== "allow,deny" &&
						orderValue !== "deny,allow" &&
						orderValue !== "mutual-failure"
					) {
						throw new Error(`Invalid Order value: ${tokens[1]}`);
					}
					config.accessControl.order = orderValue as "allow,deny" | "deny,allow" | "mutual-failure";
					break;
				}

				case "Allow":
					if (!config.accessControl) {
						config.accessControl = { allow: [], deny: [] };
					}
					config.accessControl.allow.push(parseAccessRule(tokens));
					break;

				case "Deny":
					if (!config.accessControl) {
						config.accessControl = { allow: [], deny: [] };
					}
					config.accessControl.deny.push(parseAccessRule(tokens));
					break;

				default:
					// Unknown directive - log warning but continue
					// console.warn(`Unknown directive at line ${i + 1}: ${directive}`);
					break;
			}
		} catch (error) {
			throw new Error(`Parse error at line ${i + 1}: ${(error as Error).message}`, {
				cause: error,
			});
		}
	}

	// Set default Order if access control rules exist but Order is not specified
	if (config.accessControl && !config.accessControl.order) {
		config.accessControl.order = "allow,deny"; // Apache default
	}

	return config;
}
