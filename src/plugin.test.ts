import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MatchboxPlugin } from "./plugin";

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

	it("returns Vite config defaults", () => {
		const plugin = MatchboxPlugin({ publicDir: "static" });
		const config = runHook(plugin.config);

		expect(config).toEqual({
			optimizeDeps: {
				exclude: ["matchbox"],
			},
			ssr: {
				noExternal: ["matchbox"],
			},
			assetsInclude: [
				"static/**/.htpasswd",
				"static/**/.htaccess",
				"static/**/.htdigest",
				"static/**/.htgroup",
			],
			publicDir: "static",
			esbuild: {
				jsxImportSource: "hono/jsx",
				jsx: "automatic",
			},
			define: {
				__MATCHBOX_CONFIG__: "{}",
			},
		});
	});

	it("removes CGI and htaccess artifacts after build", () => {
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

	it("skips cleanup when output directory is missing", () => {
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
