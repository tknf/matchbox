import { describe, expect, test } from "vitest";
import { createAccessControlMiddleware } from "./access-control.js";
import type { AccessControlConfig } from "./types.js";
import { Hono } from "hono";

describe("Access Control Middleware", () => {
	describe("Deny from all", () => {
		test("should deny all requests", async () => {
			const config: AccessControlConfig = {
				order: "allow,deny",
				allow: [],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test");
			expect(res.status).toBe(403);
			expect(await res.text()).toBe("Forbidden");
		});
	});

	describe("Allow from specific IP", () => {
		test("should allow specific IP", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "192.168.1.100" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.100" },
			});
			expect(res.status).toBe(200);
			expect(await res.text()).toBe("OK");
		});

		test("should deny non-matching IP", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "192.168.1.100" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "10.0.0.1" },
			});
			expect(res.status).toBe(403);
		});
	});

	describe("CIDR notation", () => {
		test("should allow IP in CIDR range", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "192.168.1.0/24" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.50" },
			});
			expect(res.status).toBe(200);
		});

		test("should deny IP outside CIDR range", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "192.168.1.0/24" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.2.50" },
			});
			expect(res.status).toBe(403);
		});
	});

	describe("Order logic", () => {
		test("allow,deny: deny takes precedence", async () => {
			const config: AccessControlConfig = {
				order: "allow,deny",
				allow: [{ type: "all" }],
				deny: [{ type: "ip", value: "10.0.0.1" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "10.0.0.1" },
			});
			expect(res.status).toBe(403);
		});

		test("deny,allow: allow takes precedence", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "10.0.0.1" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "10.0.0.1" },
			});
			expect(res.status).toBe(200);
		});

		test("mutual-failure: must match allow AND not match deny", async () => {
			const config: AccessControlConfig = {
				order: "mutual-failure",
				allow: [{ type: "ip", value: "192.168.1.0/24" }],
				deny: [{ type: "ip", value: "192.168.1.100" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			// Matches allow but not deny - should succeed
			const res1 = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.50" },
			});
			expect(res1.status).toBe(200);

			// Matches both allow and deny - should fail
			const res2 = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.100" },
			});
			expect(res2.status).toBe(403);
		});
	});

	describe("IPv6 CIDR notation", () => {
		test("should allow IPv6 address in CIDR range", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "2001:db8::/32" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "2001:db8::1" },
			});
			expect(res.status).toBe(200);
		});

		test("should deny IPv6 address outside CIDR range", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "2001:db8::/32" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "2001:db9::1" },
			});
			expect(res.status).toBe(403);
		});

		test("should deny an IPv4 client against an IPv6 CIDR rule (family mismatch)", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "2001:db8::/32" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.1" },
			});
			expect(res.status).toBe(403);
		});

		test("should deny an IPv6 client against an IPv4 CIDR rule (family mismatch)", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "192.168.1.0/24" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "2001:db8::1" },
			});
			expect(res.status).toBe(403);
		});
	});

	describe("Invalid CIDR configuration", () => {
		test("should error out instead of silently matching when the rule's CIDR prefix is malformed", async () => {
			// Bypasses the parser (which would reject this at parse time) to
			// exercise the runtime guard in isSameNetwork/matchesIP directly.
			// Hono turns the thrown error into a 500 response rather than
			// silently treating the malformed rule as "always match".
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "ip", value: "192.168.1.0/" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.50" },
			});
			expect(res.status).toBe(500);
		});
	});

	describe("Hostname matching", () => {
		test("should allow exact hostname match", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "host", value: "example.com" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { host: "example.com" },
			});
			expect(res.status).toBe(200);
		});

		test("should allow wildcard hostname match", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "host", value: "*.example.com" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { host: "subdomain.example.com" },
			});
			expect(res.status).toBe(200);
		});

		test("should deny non-matching hostname", async () => {
			const config: AccessControlConfig = {
				order: "deny,allow",
				allow: [{ type: "host", value: "*.example.com" }],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { host: "other.com" },
			});
			expect(res.status).toBe(403);
		});
	});

	describe("Default order", () => {
		test("should use allow,deny as default", async () => {
			const config: AccessControlConfig = {
				allow: [],
				deny: [{ type: "all" }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test");
			expect(res.status).toBe(403);
		});
	});

	describe("Mutual-failure order", () => {
		test("should deny when matches deny rule", async () => {
			const config: AccessControlConfig = {
				order: "mutual-failure",
				allow: [{ type: "ip", value: ["192.168.1.0/24"] }],
				deny: [{ type: "ip", value: ["192.168.1.100"] }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.100" },
			});
			expect(res.status).toBe(403);
		});

		test("should allow when matches allow and not deny", async () => {
			const config: AccessControlConfig = {
				order: "mutual-failure",
				allow: [{ type: "ip", value: ["192.168.1.0/24"] }],
				deny: [{ type: "ip", value: ["192.168.1.100"] }],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "192.168.1.50" },
			});
			expect(res.status).toBe(200);
		});

		test("should deny when does not match allow", async () => {
			const config: AccessControlConfig = {
				order: "mutual-failure",
				allow: [{ type: "ip", value: ["192.168.1.0/24"] }],
				deny: [],
			};

			const middleware = createAccessControlMiddleware(config, { trustProxy: true });
			const app = new Hono();
			app.use("*", middleware);
			app.get("*", (c) => c.text("OK"));

			const res = await app.request("/test", {
				headers: { "x-forwarded-for": "10.0.0.1" },
			});
			expect(res.status).toBe(403);
		});
	});
});

describe("Multiple IPs in single rule", () => {
	test("should match any IP in the list", async () => {
		const config: AccessControlConfig = {
			order: "deny,allow",
			allow: [{ type: "ip", value: ["192.168.1.100", "10.0.0.1", "172.16.0.0/16"] }],
			deny: [{ type: "all" }],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res1 = await app.request("/test", {
			headers: { "x-forwarded-for": "192.168.1.100" },
		});
		expect(res1.status).toBe(200);

		const res2 = await app.request("/test", {
			headers: { "x-forwarded-for": "10.0.0.1" },
		});
		expect(res2.status).toBe(200);

		const res3 = await app.request("/test", {
			headers: { "x-forwarded-for": "172.16.50.1" },
		});
		expect(res3.status).toBe(200);
	});
});

describe("Edge cases", () => {
	test("should use x-real-ip header when x-forwarded-for is not available", async () => {
		const config: AccessControlConfig = {
			order: "deny,allow",
			allow: [{ type: "ip", value: ["192.168.1.100"] }],
			deny: [{ type: "all" }],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { "x-real-ip": "192.168.1.100" },
		});
		expect(res.status).toBe(200);
	});

	test("should deny when neither allow nor deny matches with allow,deny order", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "ip", value: ["192.168.1.0/24"] }],
			deny: [{ type: "ip", value: ["10.0.0.0/24"] }],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { "x-forwarded-for": "172.16.0.1" },
		});
		expect(res.status).toBe(403);
	});

	test("should allow when neither allow nor deny matches with deny,allow order", async () => {
		const config: AccessControlConfig = {
			order: "deny,allow",
			allow: [{ type: "ip", value: ["192.168.1.0/24"] }],
			deny: [{ type: "ip", value: ["10.0.0.0/24"] }],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { "x-forwarded-for": "172.16.0.1" },
		});
		expect(res.status).toBe(200);
	});

	test("should deny with invalid order", async () => {
		const config: AccessControlConfig = {
			order: "invalid" as any,
			allow: [{ type: "all" }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(403);
	});

	test("should handle env rule without value", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "env" as any }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(403);
	});

	test("should check env variable existence", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "env", value: "TEST_VAR" }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono<{ Bindings: { TEST_VAR: string } }>();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", undefined, { TEST_VAR: "exists" });
		expect(res.status).toBe(200);
	});

	test("should deny with unknown rule type", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "unknown" as any }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(403);
	});

	test("should match host rule", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "host", value: ["example.com"] }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { host: "example.com" },
		});
		expect(res.status).toBe(200);
	});

	test("should match wildcard host rule", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "host", value: ["*.example.com"] }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { host: "sub.example.com" },
		});
		expect(res.status).toBe(200);
	});

	test("should match IP with partial byte CIDR mask", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "ip", value: ["192.168.1.0/25"] }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { "x-forwarded-for": "192.168.1.100" },
		});
		expect(res.status).toBe(200);
	});

	test("should get IP from REMOTE_ADDR env", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "ip", value: ["10.0.0.1"] }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono<{ Bindings: { REMOTE_ADDR: string } }>();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", undefined, { REMOTE_ADDR: "10.0.0.1" });
		expect(res.status).toBe(200);
	});

	test("should use default IP 127.0.0.1", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "ip", value: ["127.0.0.1"] }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(200);
	});

	test("should handle env value as array", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "env", value: ["TEST_VAR", "OTHER_VAR"] }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono<{ Bindings: { TEST_VAR: string } }>();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", undefined, { TEST_VAR: "exists" });
		expect(res.status).toBe(200);
	});

	test("should deny when IP rule has no value", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "ip" as any }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(403);
	});

	test("should deny when host rule has no value", async () => {
		const config: AccessControlConfig = {
			order: "allow,deny",
			allow: [{ type: "host" as any }],
			deny: [],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: true });
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test");
		expect(res.status).toBe(403);
	});
});

describe("SEC-003: trustProxy default", () => {
	test("ignores X-Forwarded-For by default, so a spoofed header cannot bypass an IP allow rule", async () => {
		const config: AccessControlConfig = {
			order: "deny,allow",
			allow: [{ type: "ip", value: "192.168.1.100" }],
			deny: [{ type: "all" }],
		};

		// No ipOptions passed - trustProxy defaults to false.
		const middleware = createAccessControlMiddleware(config);
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { "x-forwarded-for": "192.168.1.100" },
		});
		expect(res.status).toBe(403);
	});

	test("ignores X-Real-IP by default", async () => {
		const config: AccessControlConfig = {
			order: "deny,allow",
			allow: [{ type: "ip", value: "192.168.1.100" }],
			deny: [{ type: "all" }],
		};

		const middleware = createAccessControlMiddleware(config);
		const app = new Hono();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", {
			headers: { "x-real-ip": "192.168.1.100" },
		});
		expect(res.status).toBe(403);
	});

	test("still resolves the client IP from c.env.REMOTE_ADDR when trustProxy is false", async () => {
		const config: AccessControlConfig = {
			order: "deny,allow",
			allow: [{ type: "ip", value: "192.168.1.100" }],
			deny: [{ type: "all" }],
		};

		const middleware = createAccessControlMiddleware(config, { trustProxy: false });
		const app = new Hono<{ Bindings: { REMOTE_ADDR: string } }>();
		app.use("*", middleware);
		app.get("*", (c) => c.text("OK"));

		const res = await app.request("/test", undefined, { REMOTE_ADDR: "192.168.1.100" });
		expect(res.status).toBe(200);
	});
});
