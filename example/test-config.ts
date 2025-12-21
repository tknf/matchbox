import { MatchboxPlugin } from "../dist/plugin.mjs";

// Test case: publicDir doesn't start with "/"
const plugin = MatchboxPlugin({ publicDir: "public" });
const config = plugin.config ? plugin.config() : {};
console.log("Config:", JSON.stringify(config, null, 2));
