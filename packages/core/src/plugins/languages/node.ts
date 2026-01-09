import {
	LanguagePlugin,
	LanguagePluginOptions,
	CommandDiscovery,
	ProjectFile,
} from "../types.js";
import { LanguageProfile } from "../types.js";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Built-in Node.js / TypeScript / JavaScript language plugin.
 * Supports both TypeScript and JavaScript projects with npm/pnpm/yarn package managers.
 */
const nodePlugin: LanguagePlugin = {
	metadata: {
		id: "node",
		name: "Node.js / TypeScript / JavaScript",
		version: "1.0.0",
		description:
			"Node.js, TypeScript, and JavaScript support with npm/pnpm/yarn package managers",
		type: "language",
	},

	getLanguageProfile(
		options: LanguagePluginOptions = {}
	): LanguageProfile {
		// Simplified: toolchain only has name and versionPolicy, no detection
		const toolchain = [
			{
				name: "node",
				...(options.versionPolicies?.node && {
					versionPolicy: options.versionPolicies.node,
				}),
			},
		];

		// Add package manager tool
		if (options.packageManager) {
			toolchain.push({
				name: options.packageManager,
				...(options.versionPolicies?.[options.packageManager] && {
					versionPolicy:
						options.versionPolicies[options.packageManager],
				}),
			});
		}

		// Add TypeScript tool
		toolchain.push({
			name: "typescript",
			...(options.versionPolicies?.typescript && {
				versionPolicy: options.versionPolicies.typescript,
			}),
		});

		// Add additional tools if provided
		if (options.additionalTools) {
			toolchain.push(
				...options.additionalTools.map((tool) => ({
					name: tool.name,
					versionPolicy: tool.versionPolicy,
				}))
			);
		}

		// Determine if TypeScript is used (optional - Node.js plugin supports both JS and TS)
		const projectMarkers = ["package.json"];
		// TypeScript support is optional - project markers include tsconfig.json if present
		// but the plugin works for both JavaScript and TypeScript projects
		projectMarkers.push("tsconfig.json"); // Optional marker

		return {
			displayName: "Node.js / TypeScript / JavaScript",
			toolchain,
			projectMarkers,
		};
	},

	getDetectionCommand(toolName: string): { command: string; args?: string[] } | null {
		// Provide detection commands for tools this plugin knows about
		const detectionMap: Record<string, { command: string; args?: string[] }> = {
			node: { command: "node", args: ["--version"] },
			typescript: { command: "tsc", args: ["--version"] },
			npm: { command: "npm", args: ["--version"] },
			pnpm: { command: "pnpm", args: ["--version"] },
			yarn: { command: "yarn", args: ["--version"] },
		};
		return detectionMap[toolName] || null;
	},

	getPrompts() {
		return [
			{
				type: "select",
				name: "nodeVersionType",
				message: "Node.js version policy",
				choices: [
					{ name: "skip", message: "No policy" },
					{ name: "min", message: "Minimum version" },
					{ name: "max", message: "Maximum version" },
					{ name: "exact", message: "Exact version" },
				],
			},
			{
				type: "input",
				name: "nodeVersion",
				message: "Node.js version",
				skip: (state: { answers: { nodeVersionType?: string } }) =>
					state.answers.nodeVersionType === "skip",
			},
			{
				type: "select",
				name: "pmVersionType",
				message: "Package manager version policy",
				choices: [
					{ name: "skip", message: "No policy" },
					{ name: "min", message: "Minimum version" },
					{ name: "max", message: "Maximum version" },
					{ name: "exact", message: "Exact version" },
				],
			},
			{
				type: "input",
				name: "pmVersion",
				message: "Package manager version",
				skip: (state: { answers: { pmVersionType?: string } }) =>
					state.answers.pmVersionType === "skip",
			},
			{
				type: "select",
				name: "tsVersionType",
				message: "TypeScript version policy",
				choices: [
					{ name: "skip", message: "No policy" },
					{ name: "min", message: "Minimum version" },
					{ name: "max", message: "Maximum version" },
					{ name: "exact", message: "Exact version" },
				],
			},
			{
				type: "input",
				name: "tsVersion",
				message: "TypeScript version",
				skip: (state: { answers: { tsVersionType?: string } }) =>
					state.answers.tsVersionType === "skip",
			},
		];
	},

	async detectLanguage(repoPath: string): Promise<boolean> {
		const packageJsonPath = join(repoPath, "package.json");
		return existsSync(packageJsonPath);
	},

	async getCommandRunner(
		_repoPath: string,
		options?: { packageManager?: string }
	): Promise<{ runner: string; args: string[] } | null> {
		// Node.js repos use package managers to run commands
		const packageManager = options?.packageManager || "npm";
		return { runner: packageManager, args: ["run"] };
	},

	async discoverCommands(
		repoPath: string,
		_options?: { packageManager?: string }
	): Promise<CommandDiscovery | null> {
		const packageJsonPath = join(repoPath, "package.json");
		if (!existsSync(packageJsonPath)) {
			return null;
		}

		try {
			const packageJson = JSON.parse(
				readFileSync(packageJsonPath, "utf-8")
			);
			const scripts = packageJson.scripts || {};

			const commands: CommandDiscovery = {};
			if (scripts.test) commands.test = scripts.test;
			if (scripts.lint) commands.lint = scripts.lint;
			// Note: start commands are not auto-discovered for safety

			return Object.keys(commands).length > 0 ? commands : null;
		} catch {
			return null;
		}
	},

	getProjectFiles(): ProjectFile[] {
		return [
			{
				path: "package.json",
				required: true,
				description: "Node.js package configuration",
			},
			{
				path: "package-lock.json",
				required: false,
				description: "npm lockfile",
			},
			{
				path: "pnpm-lock.yaml",
				required: false,
				description: "pnpm lockfile",
			},
			{
				path: "yarn.lock",
				required: false,
				description: "yarn lockfile",
			},
			{
				path: "tsconfig.json",
				required: false,
				description: "TypeScript configuration (optional)",
			},
		];
	},
};

export default nodePlugin;
