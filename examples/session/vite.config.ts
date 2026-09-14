import devServer from "@hono/vite-dev-server";
import { defineConfig } from "vite-plus";
import { MatchboxPlugin } from "../../dist/plugin";

export default defineConfig({
	plugins: [
		MatchboxPlugin(),
		devServer({
			entry: "server.ts",
			exclude: [/^\/public\/.+/, /^\/favicon\.ico$/],
		}),
	],
});
