import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "edge-runtime",
		include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
		exclude: ["**/node_modules/**", ".archive/**"],
		server: { deps: { inline: ["convex-test"] } },
	},
});
