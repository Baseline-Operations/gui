import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { PluginManager } from "../plugins/manager.js";
import {
	LanguagePlugin,
	ProjectFile,
} from "../plugins/types.js";

/**
 * Utility class for discovering language-specific information from repositories.
 * Uses language plugins to detect commands, project files, and language types.
 */
export class LanguageDiscovery {
	/**
	 * Discover commands for a repository using language plugins.
	 * @param repo Repository to discover commands for
	 * @param workspaceRoot Workspace root path
	 * @param commandType Type of command to discover (test, lint, or start)
	 * @param pluginManager Optional plugin manager (uses singleton if not provided)
	 * @returns Discovered command string or null
	 */
	static async discoverCommand(
		repo: import("../types/config.js").NormalizedRepo,
		workspaceRoot: string,
		commandType: "test" | "lint" | "start",
		pluginManager?: PluginManager
	): Promise<string | null> {
		const repoPath = join(workspaceRoot, repo.path);
		const pm = pluginManager || PluginManager.getInstance();

		// Check project config first
		const projectConfigPath = join(repoPath, "baseline.project.json");
		if (existsSync(projectConfigPath)) {
			try {
				const projectConfig = JSON.parse(
					readFileSync(projectConfigPath, "utf-8")
				);
				if (projectConfig.commands?.[commandType]) {
					return projectConfig.commands[commandType];
				}
			} catch {
				// Failed to parse project config
			}
		}

		// Check baseline.json repo config
		if (repo.commands?.[commandType]) {
			return repo.commands[commandType];
		}

		// For start commands, don't auto-discover (safety)
		if (commandType === "start") {
			return null;
		}

		// Use language plugins to discover commands
		if (repo.languages && repo.languages.length > 0) {
			for (const langId of repo.languages) {
				const plugin = pm.getPlugin(langId);
				if (
					plugin &&
					plugin.metadata.type === "language" &&
					(plugin as LanguagePlugin).discoverCommands
				) {
					const languagePlugin = plugin as LanguagePlugin;
					if (!languagePlugin.discoverCommands) {
						continue;
					}

					const packageManager =
						(
							repo.packageManager ||
							repo.languages.includes("node")
						) ?
							"npm" // Default for Node.js, but plugin should handle PM detection
						:	undefined;

					const discovery =
						await languagePlugin.discoverCommands(repoPath, {
							packageManager,
						});

					if (discovery && discovery[commandType]) {
						return discovery[commandType];
					}
				}
			}
		} else {
			// No languages specified, try to detect automatically
			const allLanguagePlugins = pm.getLanguagePlugins();
			for (const plugin of allLanguagePlugins) {
				if (plugin.detectLanguage) {
					const isMatch = await plugin.detectLanguage(repoPath);
					if (isMatch && plugin.discoverCommands) {
						const discovery =
							await plugin.discoverCommands(repoPath);
						if (discovery && discovery[commandType]) {
							return discovery[commandType];
						}
					}
				}
			}
		}

		return null;
	}

	/**
	 * Get project files to check for a repository based on language plugins.
	 * @param repo Repository to get project files for
	 * @param workspaceRoot Workspace root path
	 * @param pluginManager Optional plugin manager
	 * @returns Array of project files to check
	 */
	static async getProjectFiles(
		repo: import("../types/config.js").NormalizedRepo,
		workspaceRoot: string,
		pluginManager?: PluginManager
	): Promise<ProjectFile[]> {
		const repoPath = join(workspaceRoot, repo.path);
		const pm = pluginManager || PluginManager.getInstance();
		const files: ProjectFile[] = [];

		if (repo.languages && repo.languages.length > 0) {
			for (const langId of repo.languages) {
				const plugin = pm.getPlugin(langId);
				if (
					plugin &&
					plugin.metadata.type === "language" &&
					(plugin as LanguagePlugin).getProjectFiles
				) {
					const languagePlugin = plugin as LanguagePlugin;
					if (languagePlugin.getProjectFiles) {
						const projectFiles =
							languagePlugin.getProjectFiles();
						if (projectFiles) {
							files.push(...projectFiles);
						}
					}
				}
			}
		} else {
			// Try to detect language automatically
			const allLanguagePlugins = pm.getLanguagePlugins();
			for (const plugin of allLanguagePlugins) {
				if (plugin.detectLanguage && plugin.getProjectFiles) {
					const isMatch = await plugin.detectLanguage(repoPath);
					if (isMatch) {
						const projectFiles = plugin.getProjectFiles();
						if (projectFiles && projectFiles.length > 0) {
							files.push(...projectFiles);
						}
						break; // Use first matching language
					}
				}
			}
		}

		// Deduplicate files by path
		const uniqueFiles = new Map<string, ProjectFile>();
		for (const file of files) {
			if (!uniqueFiles.has(file.path)) {
				uniqueFiles.set(file.path, file);
			}
		}

		return Array.from(uniqueFiles.values());
	}

	/**
	 * Detect the language(s) of a repository using language plugins.
	 * @param repoPath Path to the repository
	 * @param pluginManager Optional plugin manager
	 * @returns Array of detected language IDs
	 */
	static async detectLanguages(
		repoPath: string,
		pluginManager?: PluginManager
	): Promise<string[]> {
		const pm = pluginManager || PluginManager.getInstance();
		const detectedLanguages: string[] = [];

		const allLanguagePlugins = pm.getLanguagePlugins();
		for (const plugin of allLanguagePlugins) {
			if (plugin.detectLanguage) {
				const isMatch = await plugin.detectLanguage(repoPath);
				if (isMatch) {
					detectedLanguages.push(plugin.metadata.id);
				}
			}
		}

		return detectedLanguages;
	}

	/**
	 * Get the command runner for a repository based on its languages.
	 * Uses language plugins to determine the appropriate command runner.
	 * @param repo Repository to get command runner for
	 * @param workspaceRoot Workspace root path
	 * @param configManager Config manager to get package manager from
	 * @param pluginManager Optional plugin manager
	 * @returns Command runner configuration or null if commands should run directly
	 */
	static async getCommandRunner(
		repo: import("../types/config.js").NormalizedRepo,
		workspaceRoot: string,
		configManager: import("../config/manager.js").ConfigManager,
		pluginManager?: PluginManager
	): Promise<{ runner: string | null; args: string[] }> {
		const pm = pluginManager || PluginManager.getInstance();
		const repoPath = join(workspaceRoot, repo.path);

		// If package manager is explicitly set, use it (for Node.js repos)
		if (repo.packageManager) {
			return { runner: repo.packageManager, args: ["run"] };
		}

		// Try to get command runner from language plugins
		if (repo.languages && repo.languages.length > 0) {
			for (const langId of repo.languages) {
				const plugin = pm.getPlugin(langId);
				if (plugin && plugin.metadata.type === "language") {
					const languagePlugin = plugin as LanguagePlugin;
					if (languagePlugin.getCommandRunner) {
						const config = await configManager.load();
						const packageManager =
							langId === "node" && config ?
								(config.packageManager || "npm")
							:	repo.packageManager;

						const runner =
							await languagePlugin.getCommandRunner(
								repoPath,
								{ packageManager }
							);
						if (runner) {
							return runner;
						}
					}
				}
			}
		} else {
			// Auto-detect language and get command runner
			const allLanguagePlugins = pm.getLanguagePlugins();
			for (const plugin of allLanguagePlugins) {
				if (plugin.detectLanguage) {
					const isMatch = await plugin.detectLanguage(repoPath);
					if (isMatch && plugin.getCommandRunner) {
						const config = await configManager.load();
						const packageManager =
							plugin.metadata.id === "node" && config ?
								(config.packageManager || "npm")
							:	undefined;

						const runner = await plugin.getCommandRunner(
							repoPath,
							{ packageManager }
						);
						if (runner) {
							return runner;
						}
					}
				}
			}
		}

		// Fallback: For Node.js repos, use default package manager from config
		if (repo.languages?.includes("node")) {
			const config = await configManager.load();
			if (config) {
				const defaultPM = config.packageManager || "npm";
				return { runner: defaultPM, args: ["run"] };
			}
			return { runner: "npm", args: ["run"] }; // Fallback
		}

		// No command runner found - commands will run directly
		return { runner: null, args: [] };
	}
}
