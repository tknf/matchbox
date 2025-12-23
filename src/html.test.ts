import { describe, expect, test } from "vitest";
import { generateCgiError, generateCgiInfo } from "./html.js";

describe("generateCgiInfo", () => {
	test("renders CGI info sections with data", () => {
		const renderInfo = generateCgiInfo({
			$_SERVER: {
				REQUEST_METHOD: "GET",
				REQUEST_URI: "http://localhost/",
				REMOTE_ADDR: "127.0.0.1",
				USER_AGENT: "vitest",
				SCRIPT_NAME: "/index.cgi",
				PATH_INFO: "/",
				QUERY_STRING: "",
			},
			$_SESSION: { user: "alice" },
			$_REQUEST: { from: "request", count: 2, meta: { nested: true } },
			config: { siteName: "Matchbox" },
		});

		const html = String(renderInfo());
		expect(html).toContain("Matchbox CGI Version Information");
		expect(html).toContain("$_SERVER");
		expect(html).toContain("REMOTE_ADDR");
		expect(html).toContain("127.0.0.1");
		expect(html).toContain("Site Configuration");
		expect(html).toContain("siteName");
		expect(html).toContain("2");
	});

	test("renders Edge runtime label when process is unavailable", () => {
		const originalProcess = (
			globalThis as typeof globalThis & {
				process?: NodeJS.Process;
			}
		).process;
		(globalThis as any).process = undefined;

		try {
			const renderInfo = generateCgiInfo({
				$_SERVER: {
					REQUEST_METHOD: "GET",
					REQUEST_URI: "http://localhost/",
					REMOTE_ADDR: "127.0.0.1",
					USER_AGENT: "vitest",
					SCRIPT_NAME: "/index.cgi",
					PATH_INFO: "/",
					QUERY_STRING: "",
				},
				$_SESSION: {},
				$_REQUEST: {},
				config: {},
			});

			const html = String(renderInfo());
			expect(html).toContain("Matchbox Engine on Edge");
		} finally {
			(globalThis as any).process = originalProcess;
		}
	});
});

describe("generateCgiError", () => {
	test("renders runtime error details", () => {
		const html = String(
			generateCgiError({
				error: new Error("Something went wrong"),
				$_SERVER: {
					REQUEST_METHOD: "GET",
					REQUEST_URI: "http://localhost/",
					REMOTE_ADDR: "127.0.0.1",
					USER_AGENT: "vitest",
					SCRIPT_NAME: "/index.cgi",
					PATH_INFO: "/",
					QUERY_STRING: "",
				},
			}),
		);

		expect(html).toContain("Matchbox: Runtime Exception");
		expect(html).toContain("Something went wrong");
		expect(html).toContain("127.0.0.1");
	});
});
