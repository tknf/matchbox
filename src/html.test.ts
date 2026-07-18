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
	test("hides the error message and stack trace by default (debug: false)", () => {
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
		expect(html).toContain("Internal Server Error");
		expect(html).not.toContain("Something went wrong");
		expect(html).toContain("127.0.0.1");
	});

	test("includes the error message and stack trace when debug is true", () => {
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
				debug: true,
			}),
		);

		expect(html).toContain("Matchbox: Runtime Exception");
		expect(html).toContain("Something went wrong");
		expect(html).toContain("Error: Something went wrong");
		expect(html).toContain("127.0.0.1");
	});

	test("falls back to a placeholder when an Error has no stack trace", () => {
		const error = new Error("no stack here");
		error.stack = undefined;

		const html = String(
			generateCgiError({
				error,
				$_SERVER: {
					REQUEST_METHOD: "GET",
					REQUEST_URI: "http://localhost/",
					REMOTE_ADDR: "127.0.0.1",
					USER_AGENT: "vitest",
					SCRIPT_NAME: "/index.cgi",
					PATH_INFO: "/",
					QUERY_STRING: "",
				},
				debug: true,
			}),
		);

		expect(html).toContain("(no stack trace available)");
	});

	test("renders a non-Error thrown value's string form when debug is true", () => {
		const html = String(
			generateCgiError({
				error: "a plain string was thrown",
				$_SERVER: {
					REQUEST_METHOD: "GET",
					REQUEST_URI: "http://localhost/",
					REMOTE_ADDR: "127.0.0.1",
					USER_AGENT: "vitest",
					SCRIPT_NAME: "/index.cgi",
					PATH_INFO: "/",
					QUERY_STRING: "",
				},
				debug: true,
			}),
		);

		expect(html).toContain("a plain string was thrown");
	});
});
