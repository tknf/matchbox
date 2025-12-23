import fs from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";

/**
 * --- Matchbox Plugin Options ---
 */
export interface MatchboxPluginOptions {
	config?: any;
	publicDir?: string;
}

/**
 * --- Vite Plugin: Matchbox Plugin ---
 */
export const MatchboxPlugin = (options: MatchboxPluginOptions = {}): Plugin => {
	let viteConfig: ResolvedConfig;
	const siteConfig = options.config || {};
	const publicDir = options.publicDir || "public";

	return {
		name: "vite-plugin-matchbox",

		config() {
			return {
				optimizeDeps: {
					exclude: ["matchbox"],
				},
				ssr: {
					noExternal: true,
				},
				// .htpasswd, .htaccess, .htdigest, .htgroup files in /public should be treated as raw assets
				assetsInclude: [
					`${publicDir}/**/.htpasswd`,
					`${publicDir}/**/.htaccess`,
					`${publicDir}/**/.htdigest`,
					`${publicDir}/**/.htgroup`,
				],
				publicDir: publicDir,
				esbuild: {
					jsxImportSource: "hono/jsx",
					jsx: "automatic",
				},
				define: {
					__MATCHBOX_CONFIG__: JSON.stringify(siteConfig),
				},
			};
		},

		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
		},

		closeBundle() {
			const outDir = path.resolve(viteConfig.root, viteConfig.build.outDir);
			const cleanDir = (dir: string) => {
				if (!fs.existsSync(dir)) return;
				fs.readdirSync(dir).forEach((file) => {
					const fullPath = path.join(dir, file);
					if (fs.statSync(fullPath).isDirectory()) {
						cleanDir(fullPath);
					} else if (
						file.includes(".cgi.tsx") ||
						file.includes(".cgi.jsx") ||
						file === ".htpasswd" ||
						file === ".htaccess" ||
						file === ".htdigest" ||
						file === ".htgroup"
					) {
						fs.unlinkSync(fullPath);
					}
				});
			};
			cleanDir(outDir);
		},
	};
};
