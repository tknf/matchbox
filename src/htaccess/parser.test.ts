import { describe, expect, test } from "vite-plus/test";
import { parseHtaccess } from "./parser.js";

describe("Htaccess Parser", () => {
	describe("Access Control", () => {
		test("should parse 'Deny from all'", () => {
			const config = parseHtaccess("Deny from all");
			expect(config.accessControl).toEqual({
				order: "allow,deny",
				allow: [],
				deny: [{ type: "all" }],
			});
		});

		test("should parse Order directive", () => {
			const config = parseHtaccess(`
				Order deny,allow
				Deny from all
				Allow from 192.168.1.0/24
			`);
			expect(config.accessControl?.order).toBe("deny,allow");
			expect(config.accessControl?.deny).toContainEqual({ type: "all" });
			expect(config.accessControl?.allow).toContainEqual({
				type: "ip",
				value: ["192.168.1.0/24"],
			});
		});

		test("should parse multiple IPs", () => {
			const config = parseHtaccess(`
				Allow from 192.168.1.100 10.0.0.1
			`);
			expect(config.accessControl?.allow).toContainEqual({
				type: "ip",
				value: ["192.168.1.100", "10.0.0.1"],
			});
		});

		test("should parse hostname rules", () => {
			const config = parseHtaccess(`
				Allow from example.com
				Allow from *.example.org
			`);
			expect(config.accessControl?.allow).toContainEqual({
				type: "host",
				value: ["example.com"],
			});
			expect(config.accessControl?.allow).toContainEqual({
				type: "host",
				value: ["*.example.org"],
			});
		});

		test("should parse env rules", () => {
			const config = parseHtaccess("Allow from env=LOCAL_ACCESS");
			expect(config.accessControl?.allow).toContainEqual({
				type: "env",
				value: "LOCAL_ACCESS",
			});
		});

		test("should parse a valid IPv6 CIDR rule", () => {
			const config = parseHtaccess("Allow from 2001:db8::/32");
			expect(config.accessControl?.allow).toContainEqual({
				type: "ip",
				value: ["2001:db8::/32"],
			});
		});

		test("should parse boundary IPv4 and IPv6 prefixes", () => {
			expect(() => parseHtaccess("Allow from 192.168.1.0/0")).not.toThrow();
			expect(() => parseHtaccess("Allow from 192.168.1.0/32")).not.toThrow();
			expect(() => parseHtaccess("Allow from 2001:db8::/0")).not.toThrow();
			expect(() => parseHtaccess("Allow from 2001:db8::/128")).not.toThrow();
		});

		test("should throw on an empty CIDR prefix (trailing slash)", () => {
			expect(() => parseHtaccess("Allow from 192.168.1.0/")).toThrow(/Invalid CIDR prefix length/);
		});

		test("should throw on a non-numeric CIDR prefix", () => {
			// Uses an IPv6 literal because the IPv4 access-rule classifier only
			// treats digit/dot/slash-only tokens as IPs; a trailing letter would
			// fall through to the hostname branch instead. ":" always signals IP.
			expect(() => parseHtaccess("Allow from 2001:db8::/abc")).toThrow(
				/Invalid CIDR prefix length/,
			);
		});

		test("should throw on an out-of-range IPv4 CIDR prefix", () => {
			expect(() => parseHtaccess("Deny from 192.168.1.0/33")).toThrow(/Invalid CIDR prefix length/);
		});

		test("should throw on an out-of-range IPv6 CIDR prefix", () => {
			expect(() => parseHtaccess("Deny from 2001:db8::/129")).toThrow(/Invalid CIDR prefix length/);
		});
	});

	describe("Headers", () => {
		test("should parse Header set", () => {
			const config = parseHtaccess('Header set X-Frame-Options "SAMEORIGIN"');
			expect(config.headers).toContainEqual({
				action: "set",
				name: "X-Frame-Options",
				value: "SAMEORIGIN",
			});
		});

		test("should parse Header append", () => {
			const config = parseHtaccess('Header append Vary "Accept-Encoding"');
			expect(config.headers).toContainEqual({
				action: "append",
				name: "Vary",
				value: "Accept-Encoding",
			});
		});

		test("should parse Header unset", () => {
			const config = parseHtaccess("Header unset X-Powered-By");
			expect(config.headers).toContainEqual({
				action: "unset",
				name: "X-Powered-By",
			});
		});

		test("should handle quoted values with spaces", () => {
			const config = parseHtaccess("Header set Content-Security-Policy \"default-src 'self'\"");
			expect(config.headers).toContainEqual({
				action: "set",
				name: "Content-Security-Policy",
				value: "default-src 'self'",
			});
		});
	});

	describe("ErrorDocument", () => {
		test("should parse ErrorDocument", () => {
			const config = parseHtaccess("ErrorDocument 404 /errors/404.html");
			expect(config.errorDocuments).toContainEqual({
				statusCode: 404,
				target: "/errors/404.html",
			});
		});

		test("should parse multiple ErrorDocuments", () => {
			const config = parseHtaccess(`
				ErrorDocument 404 /errors/404.html
				ErrorDocument 500 /errors/500.html
			`);
			expect(config.errorDocuments).toHaveLength(2);
		});
	});

	describe("Redirect", () => {
		test("should parse Redirect with status code", () => {
			const config = parseHtaccess("Redirect 301 /old-page /new-page");
			expect(config.redirects).toContainEqual({
				type: "redirect",
				code: 301,
				source: "/old-page",
				target: "/new-page",
			});
		});

		test("should default to 302 if no status code", () => {
			const config = parseHtaccess("Redirect /old-page /new-page");
			expect(config.redirects).toContainEqual({
				type: "redirect",
				code: 302,
				source: "/old-page",
				target: "/new-page",
			});
		});
	});

	describe("RewriteRule flags", () => {
		test("should parse flags with empty flag string", () => {
			const config = parseHtaccess("RewriteRule ^/old$ /new []");
			expect(config.rewriteRules[0].flags).toEqual({});
		});
	});

	describe("RewriteRule", () => {
		test("should parse simple RewriteRule", () => {
			const config = parseHtaccess("RewriteRule ^/old$ /new [R=301,L]");
			expect(config.rewriteRules).toHaveLength(1);
			expect(config.rewriteRules[0].pattern).toBe("^/old$");
			expect(config.rewriteRules[0].target).toBe("/new");
			expect(config.rewriteRules[0].flags.redirect).toBe(301);
			expect(config.rewriteRules[0].flags.last).toBe(true);
		});

		test("should parse flags correctly", () => {
			const config = parseHtaccess("RewriteRule ^test$ /dest [NC,QSA,L]");
			expect(config.rewriteRules[0].flags.noCase).toBe(true);
			expect(config.rewriteRules[0].flags.qsAppend).toBe(true);
			expect(config.rewriteRules[0].flags.last).toBe(true);
		});

		test("should parse [F] flag", () => {
			const config = parseHtaccess("RewriteRule ^forbidden$ - [F]");
			expect(config.rewriteRules[0].flags.forbidden).toBe(true);
		});

		test("should parse [G] flag", () => {
			const config = parseHtaccess("RewriteRule ^gone$ - [G]");
			expect(config.rewriteRules[0].flags.gone).toBe(true);
		});
	});

	describe("RewriteCond", () => {
		test("should parse RewriteCond and associate with next RewriteRule", () => {
			const config = parseHtaccess(`
				RewriteCond %{HTTP_HOST} ^www\\.example\\.com$
				RewriteRule ^(.*)$ https://example.com/$1 [R=301,L]
			`);
			expect(config.rewriteRules).toHaveLength(1);
			expect(config.rewriteRules[0].conditions).toHaveLength(1);
			expect(config.rewriteRules[0].conditions[0].testString).toBe("%{HTTP_HOST}");
			expect(config.rewriteRules[0].conditions[0].pattern).toBe("^www.example.com$");
		});

		test("should parse multiple RewriteCond", () => {
			const config = parseHtaccess(`
				RewriteCond %{REQUEST_METHOD} POST
				RewriteCond %{HTTP_USER_AGENT} BadBot
				RewriteRule .* - [F]
			`);
			expect(config.rewriteRules[0].conditions).toHaveLength(2);
		});

		test("should parse [OR] flag in RewriteCond", () => {
			const config = parseHtaccess(`
				RewriteCond %{HTTP_USER_AGENT} BadBot1 [OR]
				RewriteCond %{HTTP_USER_AGENT} BadBot2
				RewriteRule .* - [F]
			`);
			expect(config.rewriteRules[0].conditions[0].flags.or).toBe(true);
			expect(config.rewriteRules[0].conditions[1].flags.or).toBeFalsy();
		});
	});

	describe("Auth Directives", () => {
		test("should parse AuthType", () => {
			const config = parseHtaccess("AuthType Basic");
			expect(config.authConfig?.authType).toBe("Basic");
		});

		test("should parse AuthName", () => {
			const config = parseHtaccess('AuthName "Restricted Area"');
			expect(config.authConfig?.authName).toBe("Restricted Area");
		});

		test("should parse AuthUserFile", () => {
			const config = parseHtaccess("AuthUserFile /path/to/.htpasswd");
			expect(config.authConfig?.authUserFile).toBe("/path/to/.htpasswd");
		});

		test("should parse Require valid-user", () => {
			const config = parseHtaccess("Require valid-user");
			expect(config.authConfig?.require).toContainEqual({
				type: "valid-user",
			});
		});

		test("should parse Require user", () => {
			const config = parseHtaccess("Require user admin moderator");
			expect(config.authConfig?.require).toContainEqual({
				type: "user",
				value: ["admin", "moderator"],
			});
		});

		test("should parse Require group", () => {
			const config = parseHtaccess("Require group developers");
			expect(config.authConfig?.require).toContainEqual({
				type: "group",
				value: ["developers"],
			});
		});

		test("should parse Require all granted", () => {
			const config = parseHtaccess("Require all granted");
			expect(config.authConfig?.require).toContainEqual({
				type: "all",
				granted: true,
			});
		});
	});

	describe("Comments and empty lines", () => {
		test("should ignore comments", () => {
			const config = parseHtaccess(`
				# This is a comment
				Deny from all
				# Another comment
			`);
			expect(config.accessControl?.deny).toHaveLength(1);
		});

		test("should ignore empty lines", () => {
			const config = parseHtaccess(`

				Deny from all

			`);
			expect(config.accessControl?.deny).toHaveLength(1);
		});
	});

	describe("Escape sequences", () => {
		test("should handle escaped quotes", () => {
			const config = parseHtaccess('Header set X-Custom "value with \\"quotes\\""');
			expect(config.headers[0].value).toBe('value with "quotes"');
		});
	});

	describe("Additional Require directives", () => {
		test("should parse Require ip", () => {
			const config = parseHtaccess("Require ip 192.168.1.0/24 10.0.0.1");
			expect(config.authConfig?.require).toContainEqual({
				type: "ip",
				value: ["192.168.1.0/24", "10.0.0.1"],
			});
		});

		test("should parse Require host", () => {
			const config = parseHtaccess("Require host example.com .example.net");
			expect(config.authConfig?.require).toContainEqual({
				type: "host",
				value: ["example.com", ".example.net"],
			});
		});

		test("should parse Require all denied", () => {
			const config = parseHtaccess("Require all denied");
			expect(config.authConfig?.require).toContainEqual({
				type: "all",
				granted: false,
			});
		});
	});

	describe("AuthDigestProvider", () => {
		test("should parse AuthDigestProvider", () => {
			const config = parseHtaccess("AuthDigestProvider file");
			expect(config.authConfig?.authDigestProvider).toBe("file");
		});

		test("should handle invalid AuthDigestProvider without provider", () => {
			expect(() => parseHtaccess("AuthDigestProvider")).toThrow(
				"AuthDigestProvider requires a provider name",
			);
		});
	});

	describe("Order directive", () => {
		test("should handle invalid Order without argument", () => {
			expect(() => parseHtaccess("Order")).toThrow("Order directive requires an argument");
		});

		test("should handle invalid Order value", () => {
			expect(() => parseHtaccess("Order invalid-value")).toThrow("Invalid Order value");
		});
	});

	describe("Unknown directive", () => {
		test("should ignore unknown directives", () => {
			const config = parseHtaccess("UnknownDirective value");
			expect(config).toBeDefined();
		});
	});

	describe("Error cases", () => {
		test("should handle invalid Require directive", () => {
			expect(() => parseHtaccess("Require")).toThrow();
		});

		test("should handle invalid Require all without granted/denied", () => {
			expect(() => parseHtaccess("Require all")).toThrow(
				"Require all must specify granted or denied",
			);
		});

		test("should handle invalid Require user without username", () => {
			expect(() => parseHtaccess("Require user")).toThrow(
				"Require user must specify at least one username",
			);
		});

		test("should handle invalid Require group without group name", () => {
			expect(() => parseHtaccess("Require group")).toThrow(
				"Require group must specify at least one group name",
			);
		});

		test("should handle invalid Require ip without IP", () => {
			expect(() => parseHtaccess("Require ip")).toThrow(
				"Require ip must specify at least one IP or CIDR",
			);
		});

		test("should handle invalid Require host without hostname", () => {
			expect(() => parseHtaccess("Require host")).toThrow(
				"Require host must specify at least one hostname",
			);
		});

		test("should handle unknown Require type", () => {
			expect(() => parseHtaccess("Require unknown value")).toThrow("Unknown Require type: unknown");
		});

		test("should handle invalid ErrorDocument directive", () => {
			expect(() => parseHtaccess("ErrorDocument")).toThrow();
		});

		test("should handle invalid ErrorDocument with non-numeric status", () => {
			expect(() => parseHtaccess("ErrorDocument abc /error.html")).toThrow();
		});

		test("should handle invalid Header directive without enough tokens", () => {
			expect(() => parseHtaccess("Header set")).toThrow();
		});

		test("should handle invalid RewriteRule without enough tokens", () => {
			expect(() => parseHtaccess("RewriteRule")).toThrow();
		});

		test("should handle invalid Redirect with insufficient arguments", () => {
			expect(() => parseHtaccess("Redirect")).toThrow();
		});

		test("should handle invalid AuthType", () => {
			expect(() => parseHtaccess("AuthType Unknown")).toThrow();
		});
	});
});

describe("Multiple directives combinations", () => {
	test("should parse Header with complex quoted values", () => {
		const config = parseHtaccess(
			"Header set Content-Security-Policy \"default-src 'self'; script-src 'unsafe-inline'\"",
		);
		expect(config.headers[0].name).toBe("Content-Security-Policy");
		expect(config.headers[0].value).toBe("default-src 'self'; script-src 'unsafe-inline'");
	});

	test("should parse Redirect with code", () => {
		const config = parseHtaccess("Redirect 301 /old /new");
		expect(config.redirects[0].code).toBe(301);
		expect(config.redirects[0].source).toBe("/old");
		expect(config.redirects[0].target).toBe("/new");
	});

	test("should parse RedirectPermanent", () => {
		const config = parseHtaccess("RedirectPermanent /old /new");
		expect(config.redirects[0].code).toBe(301);
		expect(config.redirects[0].type).toBe("redirect");
	});

	test("should parse RedirectTemp", () => {
		const config = parseHtaccess("RedirectTemp /old /new");
		expect(config.redirects[0].code).toBe(302);
		expect(config.redirects[0].type).toBe("redirect");
	});
});
