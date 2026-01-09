// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default tseslint.config(
	{
		files: ["eslint.config.js", "vitest.config.ts", "vite.config.ts", "electron/**/*.ts", "electron/**/*.js", "**/*.d.ts"],
		languageOptions: {
			parserOptions: {},
		},
	},
	{
		ignores: [
			"dist/**",
			"electron/dist/**",
			"node_modules/**",
			"**/*.test.ts",
			"**/__tests__/**",
			"eslint.config.js",
			"vitest.config.ts",
			"vite.config.ts",
			"**/*.d.ts",
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: __dirname,
			},
		},
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"react/react-in-jsx-scope": "off", // React 17+ doesn't need React import
		},
	}
);
