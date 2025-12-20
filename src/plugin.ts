import fs from "node:fs";
import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { generateVirtualModule } from "./virtual";

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
	const virtualModuleId = "virtual:matchbox-pages";
	const resolvedvirtualModuleId = "\0" + virtualModuleId;
	const siteConfig = options.config || {};
	const publicDir = options.publicDir || "public";

	return {
		name: "vite-plugin-matchbox",

		config() {
			return {
				// .cgi.tsx, .htpasswd, .htaccess files in /public
				assetsInclude: [
					`${publicDir}/**/*.cgi.{(j|t)sx}`,
					`${publicDir}/**/.htpasswd`,
					`${publicDir}/**/.htaccess`,
				],
				publicDir: publicDir,
				esbuild: {
					jsxImportSource: "hono/jsx",
					jsx: "automatic",
				},
			};
		},

		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
		},

		resolveId(id) {
			if (id === virtualModuleId) {
				return resolvedvirtualModuleId;
			}
		},

		load(id) {
			if (id === resolvedvirtualModuleId) {
				return generateVirtualModule({ publicDir, config: siteConfig });
			}
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
						file === ".htaccess"
					) {
						fs.unlinkSync(fullPath);
					}
				});
			};
			cleanDir(outDir);
		},
	};
};
