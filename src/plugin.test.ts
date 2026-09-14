import fs from "node:fs";
import path from "node:path";
import { createLogger, createServer } from "vite-plus";
import { describe, expect, test, vi } from "vite-plus/test";
import { MatchboxPlugin } from "./plugin.js";

describe("MatchboxPlugin", () => {
	const runHook = <T extends (...args: any[]) => any>(
		hook: unknown,
		...args: Parameters<T>
	): ReturnType<T> | undefined => {
		if (typeof hook === "function") {
			return hook(...args) as ReturnType<T>;
		}
		if (hook && typeof hook === "object" && "handler" in hook) {
			return (hook as { handler: T }).handler(...args);
		}
		return undefined;
	};

	test("returns Vite config defaults", () => {
		const plugin = MatchboxPlugin({ publicDir: "static" });
		const config = runHook(plugin.config);

		expect(config).toEqual({
			optimizeDeps: {
				exclude: ["matchbox"],
			},
			ssr: {
				noExternal: true,
			},
			assetsInclude: [
				"static/**/.htpasswd",
				"static/**/.htaccess",
				"static/**/.htdigest",
				"static/**/.htgroup",
			],
			publicDir: "static",
			oxc: {
				jsx: {
					runtime: "automatic",
					importSource: "hono/jsx",
				},
			},
			define: {
				__MATCHBOX_CONFIG__: "{}",
			},
		});
	});

	test("renders Hono JSX without esbuild compatibility warnings", async () => {
		const root = fs.mkdtempSync(path.join(process.cwd(), "tmp-matchbox-"));
		const logger = createLogger("silent");
		const warn = vi.spyOn(logger, "warn");
		let server: Awaited<ReturnType<typeof createServer>> | undefined;

		try {
			// Avoid inheriting the repository's JSX settings: the plugin must supply them.
			fs.writeFileSync(path.join(root, "tsconfig.json"), "{}");
			fs.writeFileSync(path.join(root, "page.cgi.tsx"), "export default () => <h1>Hono JSX</h1>;");
			server = await createServer({
				root,
				configFile: false,
				customLogger: logger,
				plugins: [MatchboxPlugin()],
				server: { middlewareMode: true, hmr: false, watch: null },
			});
			const page = (await server.ssrLoadModule("/page.cgi.tsx")) as {
				default: () => { toString: () => string };
			};

			expect(page.default().toString()).toBe("<h1>Hono JSX</h1>");
			expect(warn).not.toHaveBeenCalled();
		} finally {
			await server?.close();
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("removes CGI and htaccess artifacts after build", () => {
		const plugin = MatchboxPlugin({ publicDir: "public" });
		const root = fs.mkdtempSync(path.join(process.cwd(), "tmp-matchbox-"));
		const outDir = path.join(root, "dist");
		fs.mkdirSync(path.join(outDir, "nested"), { recursive: true });

		const keepFile = path.join(outDir, "keep.txt");
		const deleteFiles = [
			path.join(outDir, "page.cgi.tsx"),
			path.join(outDir, "page.cgi.jsx"),
			path.join(outDir, ".htpasswd"),
			path.join(outDir, ".htaccess"),
			path.join(outDir, ".htdigest"),
			path.join(outDir, ".htgroup"),
			path.join(outDir, "nested", "nested.cgi.tsx"),
		];

		fs.writeFileSync(keepFile, "keep");
		deleteFiles.forEach((file) => {
			fs.writeFileSync(file, "remove");
		});

		runHook(plugin.configResolved, {
			root,
			build: { outDir: "dist" },
		} as any);

		try {
			runHook(plugin.closeBundle);
			deleteFiles.forEach((file) => {
				expect(fs.existsSync(file)).toBe(false);
			});
			expect(fs.existsSync(keepFile)).toBe(true);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});

	test("skips cleanup when output directory is missing", () => {
		const plugin = MatchboxPlugin();
		const root = fs.mkdtempSync(path.join(process.cwd(), "tmp-matchbox-"));

		try {
			runHook(plugin.configResolved, {
				root,
				build: { outDir: "dist" },
			} as any);

			expect(() => runHook(plugin.closeBundle)).not.toThrow();
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
