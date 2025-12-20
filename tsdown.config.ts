import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/plugin.ts"],
	dts: true,
	tsconfig: "./tsconfig.build.json",
	minify: false,
	outDir: "dist",
	format: ["esm"],
	platform: "node",
});
