import { existsSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { mkdir, writeFile } from "fs/promises";
import { ConfigManager } from "../../config/manager.js";
import { ProjectConfig, BaselineConfig } from "../../types/config.js";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";
import { ProjectConfigLoader } from "../../utils/project-config.js";
import { EditorPlugin } from "../../plugins/types.js";

export interface ConfigOptions {
	repo?: string;
	force?: boolean;
	workspaceRoot?: string;
}

export interface ConfigResult {
	success: boolean;
	generated: number;
	updated: number;
	skipped: number;
	totalRepos: number;
	configFiles: Array<{ repo: string; path: string; commands: string[] }>;
	messages: Array<{
		type: "info" | "success" | "error" | "warn" | "dim";
		message: string;
	}>;
	errorRepos: Array<{ name: string; error: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
}

/**
 * Generate or update project configuration files for repositories.
 * Creates baseline.project.json files in each repo with test/lint/start commands.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function configRepositories(
	options: ConfigOptions = {}
): Promise<ConfigResult> {
	const messages: Array<{
		type: "info" | "success" | "error" | "warn" | "dim";
		message: string;
	}> = [];
	const errorRepos: Array<{ name: string; error: string }> = [];
	const skippedRepos: Array<{ name: string; reason: string }> = [];
	const configFiles: Array<{
		repo: string;
		path: string;
		commands: string[];
	}> = [];

	let workspaceRoot = options.workspaceRoot;
	const configManager =
		workspaceRoot ?
			new ConfigManager(workspaceRoot)
		:	new ConfigManager();

	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}

	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			generated: 0,
			updated: 0,
			skipped: 0,
			totalRepos: 0,
			configFiles: [],
			messages: [
				{
					type: "error",
					message:
						"No baseline workspace found. Run `baseline init` first.",
				},
			],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import(
		"../../utils/config-helpers.js"
	);
	const allReposNormalized = normalizeAllRepos(
		config.packages || config.repos,
		workspaceRoot
	);

	const reposToProcess =
		options.repo ?
			allReposNormalized.filter((r) => r.name === options.repo)
		:	allReposNormalized;

	if (reposToProcess.length === 0) {
		return {
			success: false,
			generated: 0,
			updated: 0,
			skipped: 0,
			totalRepos: 0,
			configFiles: [],
			messages: [
				{
					type: "error",
					message:
						options.repo ?
							`Repository "${options.repo}" not found.`
						:	"No repositories configured.",
				},
			],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	messages.push({
		type: "info",
		message: "Generating Project Configurations",
	});

	let generated = 0;
	let updated = 0;
	let skipped = 0;

	for (const repo of reposToProcess) {
		try {
			const repoPath = join(workspaceRoot, repo.path);
			const projectConfigPath = join(
				repoPath,
				"baseline.project.json"
			);

			if (!existsSync(repoPath)) {
				const reason = "not cloned";
				messages.push({
					type: "warn",
					message: `Skipping ${repo.name} (${reason})`,
				});
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			// Use language plugins to discover commands
			const pluginManager = PluginManager.getInstance();
			await pluginManager.initialize();

			const defaultCommands: {
				test?: string;
				lint?: string;
				start?: string;
			} = {};

			// Discover commands using language plugins
			const testCommand = await LanguageDiscovery.discoverCommand(
				repo,
				workspaceRoot,
				"test",
				pluginManager
			);
			if (testCommand) defaultCommands.test = testCommand;

			const lintCommand = await LanguageDiscovery.discoverCommand(
				repo,
				workspaceRoot,
				"lint",
				pluginManager
			);
			if (lintCommand) defaultCommands.lint = lintCommand;

			// Note: start commands are not auto-discovered for safety

			// Merge with existing commands if config already exists
			const configExists = existsSync(projectConfigPath);
			const projectConfig =
				configExists && !options.force ?
					ProjectConfigLoader.load(repoPath) || {}
				:	{};

			// Merge commands (existing takes precedence over defaults)
			const commands = {
				...defaultCommands,
				...(projectConfig.commands || {}),
				...(repo.commands || {}),
			};

			// Only include commands that are defined
			const finalCommands: Record<string, string> = {};
			if (commands.test) finalCommands.test = commands.test;
			if (commands.lint) finalCommands.lint = commands.lint;
			if (commands.start) finalCommands.start = commands.start;

			// Build project config
			const newProjectConfig: Partial<ProjectConfig> = {
				name: repo.name,
				library: repo.library ?? projectConfig.library ?? false,
				commands:
					Object.keys(finalCommands).length > 0 ?
						finalCommands
					:	undefined,
			};

			if (repo.startInDocker) {
				newProjectConfig.startInDocker = true;
				if (repo.dockerImage) {
					newProjectConfig.dockerImage = repo.dockerImage;
				}
			}

			// Preserve existing requiredPlugins if they exist
			if (projectConfig.requiredPlugins) {
				newProjectConfig.requiredPlugins =
					projectConfig.requiredPlugins;
			}

			writeFileSync(
				projectConfigPath,
				JSON.stringify(newProjectConfig, null, 2) + "\n"
			);

			if (configExists) {
				messages.push({
					type: "success",
					message: `Updated ${repo.name}`,
				});
				updated++;
			} else {
				messages.push({
					type: "success",
					message: `Generated ${repo.name}`,
				});
				generated++;
			}

			if (Object.keys(finalCommands).length > 0) {
				messages.push({
					type: "dim",
					message: `  Commands: ${Object.keys(finalCommands).join(", ")}`,
				});
				configFiles.push({
					repo: repo.name,
					path: projectConfigPath,
					commands: Object.keys(finalCommands),
				});
			} else {
				configFiles.push({
					repo: repo.name,
					path: projectConfigPath,
					commands: [],
				});
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : String(error);
			messages.push({
				type: "error",
				message: `Failed to generate config for ${repo.name}: ${errorMsg}`,
			});
			errorRepos.push({ name: repo.name, error: errorMsg });
		}
	}

	// Generate editor workspace files if editor is configured
	if (config.editor) {
		messages.push({
			type: "info",
			message: "Generating Editor Workspace Files",
		});
		const pluginManager = PluginManager.getInstance();
		await pluginManager.initialize();
		const editorPlugins = pluginManager.getPluginsByType("editor");
		const editorIds =
			typeof config.editor === "string" ?
				[config.editor]
			:	config.editor;

		for (const editorPlugin of editorPlugins) {
			const ep = editorPlugin as EditorPlugin;
			const shouldGenerate = editorIds.includes(ep.metadata.id);

			if (shouldGenerate && ep.generateWorkspaceFile) {
				try {
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
						messages.push({
							type: "success",
							message: `Generated ${workspaceFile.file}`,
						});
					}
				} catch (error) {
					const errorMsg =
						error instanceof Error ?
							error.message
						:	String(error);
					messages.push({
						type: "error",
						message: `Failed to generate ${ep.metadata.name} workspace: ${errorMsg}`,
					});
				}
			}
		}
	}

	messages.push({ type: "info", message: "Configuration Summary" });
	messages.push({ type: "info", message: `Generated: ${generated}` });
	messages.push({ type: "info", message: `Updated: ${updated}` });
	if (skipped > 0) {
		messages.push({ type: "info", message: `Skipped: ${skipped}` });
	}

	return {
		success: errorRepos.length === 0,
		generated,
		updated,
		skipped,
		totalRepos: reposToProcess.length,
		configFiles,
		messages,
		errorRepos,
		skippedRepos,
	};
}
