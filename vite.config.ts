import { glob } from "glob";
import { defineConfig } from "vite-plus";

const entryPoints = glob.sync("./src/**/*.+(ts|tsx|json)", {
	posix: true,
	ignore: ["./src/**/*.test.+(ts|tsx)"],
});

export default defineConfig({
	oxc: {
		jsx: {
			runtime: "automatic",
			importSource: "hono/jsx",
		},
	},
	staged: {
		"*": "pnpm check:fix",
	},
	pack: {
		entry: entryPoints,
		tsconfig: "tsconfig.build.json",
		dts: true,
		minify: false,
		format: ["esm"],
		fixedExtension: false,
		unbundle: true,
		// Resolve application routes and access files in the consumer's Vite build.
		globImport: false,
		deps: {
			neverBundle: true,
		},
		platform: "node",
		target: "es2022",
		define: {
			__version__: JSON.stringify(process.env.npm_package_version || "dev"),
		},
	},
	test: {
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/**/*.ts"],
			exclude: ["src/with-defaults.ts", "src/index.ts"],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 90,
				statements: 90,
			},
		},
	},
	fmt: {
		ignorePatterns: ["**/node_modules/**", "**/dist/**", "coverage/**"],
		endOfLine: "lf",
		printWidth: 100,
		useTabs: true,
		embeddedLanguageFormatting: "off",
	},
	lint: {
		ignorePatterns: ["**/node_modules/**", "**/dist/**", "coverage/**"],
		plugins: ["import"],
		categories: {
			correctness: "error",
			suspicious: "error",
		},
		rules: {
			"no-underscore-dangle": [
				"error",
				{ allow: ["__version__", "__type", "__MATCHBOX_CONFIG__"] },
			],
			"vite-plus/prefer-vite-plus-imports": "error",
		},
		options: {
			typeAware: true,
			typeCheck: true,
		},
		jsPlugins: [
			{
				name: "vite-plus",
				specifier: "vite-plus/oxlint-plugin",
			},
		],
	},
});
