import enquirer from "enquirer";
const { prompt } = enquirer;
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { ConfigManager, BASELINE_CONFIG_FILE } from "../../config/manager.js";
import { BaselineConfig } from "../../types/config.js";
// Logger removed - this is a pure function, logging is handled by CLI wrapper
import {
	PackageManagerUtil,
	PackageManager,
} from "../../utils/package-manager.js";
// Note: createCommandExample removed - command.example is in CLI package
import { execa } from "execa";
import { PluginManager } from "../../plugins/manager.js";
import { VersionPolicy, LanguageProfile } from "../../plugins/types.js";
import { EditorPlugin } from "../../plugins/types.js";

interface InitAnswers {
	workspaceName: string;
	version: string;
	packageManager: PackageManager;
	languages: string[];
	nodeVersion?: { type: "min" | "max" | "exact"; value?: string };
	packageManagerVersion?: {
		type: "min" | "max" | "exact";
		value?: string;
	};
	typescriptVersion?: { type: "min" | "max" | "exact"; value?: string };
	generateGitignore: boolean;
	generateVSCode: boolean;
	generateCursor: boolean;
	generateIntelliJ: boolean;
	generateSublime: boolean;
	enableGitHub: boolean;
	useGhCli: boolean;
}

export interface InitOptions {
	force?: boolean;
	workspaceRoot?: string;
}

export interface InitResult {
	success: boolean;
	workspaceRoot: string;
	configPath: string;
	generatedFiles: string[];
	errors?: string[];
}

/**
 * Initialize a new baseline workspace.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function initWorkspace(
	options: InitOptions = {}
): Promise<InitResult> {
	const workspaceRoot = options.workspaceRoot || process.cwd();
	const configManager = new ConfigManager();

	if (configManager.exists() && !options.force) {
		return {
			success: false,
			workspaceRoot,
			configPath: configManager.getConfigPath(),
			generatedFiles: [],
			errors: [
				`${BASELINE_CONFIG_FILE} already exists. Use --force to overwrite.`,
			],
		};
	}

	const generatedFiles: string[] = [];
	const errors: string[] = [];

	try {
		// Initialize plugin manager and load plugins
		const pluginManager = PluginManager.getInstance();
		await pluginManager.initialize();

		// Detect package manager using plugins
		const pmPlugins =
			pluginManager.getPluginsByType("package-manager");
		const pmInstalled = new Set<string>();
		const pmChoices: Array<{ name: string; message: string }> = [];

		for (const pmPlugin of pmPlugins) {
			const pm =
				pmPlugin as import("../../plugins/types.js").PackageManagerPlugin;
			if (pm.isInstalled) {
				const isInstalled = await pm.isInstalled();
				if (isInstalled) {
					pmInstalled.add(pm.metadata.id);
					pmChoices.push({
						name: pm.metadata.id,
						message: pm.metadata.name,
					});
				}
			}
		}

		if (pmChoices.length === 0) {
			return {
				success: false,
				workspaceRoot,
				configPath: configManager.getConfigPath(),
				generatedFiles: [],
				errors: [
					"No package manager (npm/pnpm/yarn) found. Please install at least one.",
				],
			};
		}

		// Try to detect which package manager to use
		const detectedPM = await PackageManagerUtil.detect(workspaceRoot);
		const defaultPM =
			detectedPM && pmInstalled.has(detectedPM) ?
				detectedPM
			:	pmChoices[0].name;

		const answers = await prompt<InitAnswers>([
			{
				type: "input",
				name: "workspaceName",
				message: "Workspace name",
				initial: "my-workspace",
			},
			{
				type: "input",
				name: "version",
				message: "Initial version",
				initial: "0.1.0",
			},
			{
				type: "select",
				name: "packageManager",
				message: "Package manager",
				choices: pmChoices,
				initial: pmChoices.findIndex((c) => c.name === defaultPM),
			},
			{
				type: "multiselect",
				name: "languages",
				message: "Languages used in this workspace",
				choices: pluginManager
					.getLanguagePlugins()
					.map((plugin) => ({
						name: plugin.metadata.id,
						message: plugin.metadata.name,
					}))
					.concat([
						{ name: "other", message: "Other (custom)" },
					]),
			},
			{
				type: "confirm",
				name: "generateGitignore",
				message: "Generate .gitignore template?",
				initial: true,
			},
			{
				type: "confirm",
				name: "generateVSCode",
				message: "Generate VS Code workspace file?",
				initial: true,
			},
			{
				type: "confirm",
				name: "generateCursor",
				message: "Generate Cursor workspace file?",
				initial: true,
			},
			{
				type: "confirm",
				name: "generateIntelliJ",
				message: "Generate IntelliJ IDEA workspace configuration?",
				initial: false,
			},
			{
				type: "confirm",
				name: "generateSublime",
				message: "Generate Sublime Text project file?",
				initial: false,
			},
			{
				type: "confirm",
				name: "enableGitHub",
				message: "Enable GitHub integration?",
				initial: true,
			},
		]);

		// Check if gh CLI is available
		let useGhCli = false;
		if (answers.enableGitHub) {
			try {
				await execa("gh", ["--version"]);
				useGhCli = true;
			} catch {
				useGhCli = false;
			}
		}

		// Collect language-specific version rules using plugins
		const languagesConfig: Record<string, LanguageProfile> = {};

		// Process selected languages using plugins
		for (const langId of answers.languages) {
			if (langId === "other") {
				// Skip custom languages for now
				continue;
			}

			const plugin = pluginManager.getPlugin(langId);
			if (!plugin || plugin.metadata.type !== "language") {
				errors.push(`Plugin not found for language: ${langId}. Skipping.`);
				continue;
			}

			const languagePlugin =
				plugin as import("../../plugins/types.js").LanguagePlugin;

			// Get prompts from plugin if available (for version policies)
			const versionPolicies: Record<string, VersionPolicy> = {};
			if (languagePlugin.getPrompts && langId === "node") {
				// Special handling for Node.js plugin to collect version policies
				const pluginPrompts = languagePlugin.getPrompts();
				// Update package manager prompt message with actual PM name
				const pmPrompt = pluginPrompts.find(
					(p: { name?: string }) => p.name === "pmVersionType"
				);
				if (pmPrompt) {
					pmPrompt.message = `${answers.packageManager} version policy`;
				}
				const pmVersionInput = pluginPrompts.find(
					(p: { name?: string }) => p.name === "pmVersion"
				);
				if (pmVersionInput) {
					pmVersionInput.message = `${answers.packageManager} version`;
				}

				const nodeVersionRules = await prompt<{
					nodeVersionType: "min" | "max" | "exact" | "skip";
					nodeVersion: string;
					pmVersionType: "min" | "max" | "exact" | "skip";
					pmVersion: string;
					tsVersionType: "min" | "max" | "exact" | "skip";
					tsVersion: string;
				}>(pluginPrompts);

				if (
					nodeVersionRules.nodeVersionType !== "skip" &&
					nodeVersionRules.nodeVersion
				) {
					versionPolicies.node = {
						[nodeVersionRules.nodeVersionType]:
							nodeVersionRules.nodeVersion,
					};
				}

				if (
					nodeVersionRules.pmVersionType !== "skip" &&
					nodeVersionRules.pmVersion
				) {
					versionPolicies[answers.packageManager] = {
						[nodeVersionRules.pmVersionType]:
							nodeVersionRules.pmVersion,
					};
				}

				if (
					nodeVersionRules.tsVersionType !== "skip" &&
					nodeVersionRules.tsVersion
				) {
					versionPolicies.typescript = {
						[nodeVersionRules.tsVersionType]:
							nodeVersionRules.tsVersion,
					};
				}
			}

			// Get language profile from plugin
			const profile = languagePlugin.getLanguageProfile({
				packageManager:
					langId === "node" ? answers.packageManager : undefined,
				versionPolicies:
					Object.keys(versionPolicies).length > 0 ?
						versionPolicies
					:	undefined,
			});

			languagesConfig[langId] = profile;
		}

		// Build simplified config
		// Convert language profiles to simplified version policies map
		const languagesConfigSimplified: Record<string, string> = {};
		for (const [, profile] of Object.entries(languagesConfig)) {
			// Extract version policies from toolchain
			for (const tool of profile.toolchain) {
				if (tool.versionPolicy) {
					// Convert VersionPolicy to version string
					if (tool.versionPolicy.min) {
						languagesConfigSimplified[tool.name] = `>=${tool.versionPolicy.min}`;
					} else if (tool.versionPolicy.max) {
						languagesConfigSimplified[tool.name] = `<=${tool.versionPolicy.max}`;
					} else if (tool.versionPolicy.exact) {
						languagesConfigSimplified[tool.name] = tool.versionPolicy.exact;
					}
				}
			}
		}

		const config: BaselineConfig = {
			private: true, // Not used, kept for compatibility
			packages: [],
			languages: Object.keys(languagesConfigSimplified).length > 0 ? languagesConfigSimplified : undefined,
			packageManager: answers.packageManager,
			github:
				answers.enableGitHub ?
					{
						provider: "github",
						useGhCli: useGhCli,
						defaultBaseBranch: "main",
					}
				:	undefined,
			editor: (() => {
				const editors: string[] = [];
				if (answers.generateVSCode) editors.push("vscode");
				if (answers.generateCursor) editors.push("cursor");
				if (answers.generateIntelliJ) editors.push("intellij");
				if (answers.generateSublime) editors.push("sublime");
				return editors.length === 1 ? editors[0] : editors.length > 1 ? editors : undefined;
			})(),
		};

		// Save config
		await configManager.save(config);
		generatedFiles.push(BASELINE_CONFIG_FILE);

		// Generate files
		if (answers.generateGitignore) {
			await generateGitignore(workspaceRoot);
			generatedFiles.push(".gitignore");
		}

		// Generate editor workspace files using plugins
		if (config.editor) {
			const editorPlugins = pluginManager.getPluginsByType("editor");
			const editorIds = typeof config.editor === "string" ? [config.editor] : config.editor;

			for (const editorPlugin of editorPlugins) {
				const ep = editorPlugin as EditorPlugin;
				const shouldGenerate = editorIds.includes(ep.metadata.id);

				if (shouldGenerate && ep.generateWorkspaceFile) {
					const workspaceFile = await ep.generateWorkspaceFile(
						config,
						workspaceRoot
					);
					if (workspaceFile) {
						// Create directory if needed (e.g., .idea for IntelliJ)
						const targetPath = join(
							workspaceRoot,
							workspaceFile.file
						);
						await mkdir(dirname(targetPath), {
							recursive: true,
						});

						await writeFile(targetPath, workspaceFile.content);
						generatedFiles.push(workspaceFile.file);
					}
				}
			}
		}

		// Note: command.example is in the CLI package, not created in workspace

		return {
			success: true,
			workspaceRoot,
			configPath: configManager.getConfigPath(),
			generatedFiles,
		};
	} catch (error) {
		if (error instanceof Error && error.message.includes("cancel")) {
			return {
				success: false,
				workspaceRoot,
				configPath: configManager.getConfigPath(),
				generatedFiles,
				errors: ["Setup cancelled."],
			};
		}
		return {
			success: false,
			workspaceRoot,
			configPath: configManager.getConfigPath(),
			generatedFiles,
			errors: [
				`Setup failed: ${error instanceof Error ? error.message : String(error)}`,
			],
		};
	}
}

async function generateGitignore(root: string): Promise<void> {
	const content = `# Baseline workspace
baseline.json
.code-workspace
.cursor-workspace

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo
*~

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# Baseline runtime data
.baseline/
!.baseline/command.example
`;
	await writeFile(join(root, ".gitignore"), content);
}
