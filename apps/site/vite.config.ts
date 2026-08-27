import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	// .env.local staat in de monorepo-root, niet in deze app-map.
	envDir: "../../",
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		viteTsConfigPaths({
			// ook het ui-package, anders blijven de `@/` imports daarbinnen onopgelost
			projects: ["./tsconfig.json", "../../packages/ui/tsconfig.json"],
			// loose, zodat `@/styles.css?url` en losse assets ook via de aliassen gaan
			loose: true,
		}),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});
