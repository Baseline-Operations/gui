import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules/",
				"dist/",
				"**/*.test.ts",
				"**/*.spec.ts",
				"**/__tests__/**",
				"**/__mocks__/**",
			],
		},
		include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	root: __dirname,
});
