import {
	BaselinePlugin,
	LanguagePlugin,
	LanguagePluginOptions,
	PluginPackage,
	PluginRequirement,
	LanguageProfile,
} from "./types.js";
import { Logger } from "../utils/logger.js";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname, extname } from "path";
import { pathToFileURL, fileURLToPath } from "url";
import { readFile } from "fs/promises";

/**
 * Plugin manager for loading and managing baseline plugins.
 * Supports built-in plugins and external plugin discovery.
 */
export class PluginManager {
	private static instance: PluginManager;
	private plugins: Map<string, BaselinePlugin> = new Map();

	private constructor() {
		// Private constructor for singleton
	}

	/**
	 * Get singleton instance of PluginManager.
	 */
	static getInstance(): PluginManager {
		if (!PluginManager.instance) {
			PluginManager.instance = new PluginManager();
		}
		return PluginManager.instance;
	}

	/**
	 * Initialize the plugin manager and load built-in plugins.
	 * Automatically discovers external plugins if workspace root is available.
	 * Also installs plugins from baseline.json dependencies if needed.
	 */
	async initialize(): Promise<void> {
		await this.loadBuiltInPlugins();

		// Try to discover external plugins from workspace root
		// Use ConfigManager to find workspace root if available
		try {
			const { ConfigManager } = await import("../config/manager.js");
			const workspaceRoot = ConfigManager.findWorkspaceRoot();
			if (workspaceRoot) {
				// Check if plugins need to be installed
				const config = await new ConfigManager().load();
				if (config?.plugins?.dependencies) {
					const { PluginInstaller } = await import(
						"../utils/plugin-installer.js"
					);
					const lock =
						await PluginInstaller.loadLock(workspaceRoot);

					// Install missing plugins
					for (const [pluginId, dependency] of Object.entries(
						config.plugins.dependencies
					)) {
						if (!lock.plugins[pluginId]) {
							try {
								Logger.debug(
									`Auto-installing plugin ${pluginId}...`
								);
								const installed =
									await PluginInstaller.install(
										workspaceRoot,
										pluginId,
										dependency
									);
								lock.plugins[installed.id] = installed;
								await PluginInstaller.saveLock(
									workspaceRoot,
									lock
								);
							} catch (error) {
								Logger.warn(
									`Failed to auto-install plugin ${pluginId}: ${error instanceof Error ? error.message : String(error)}`
								);
							}
						}
					}
				}

				await this.discoverExternalPlugins(workspaceRoot);

				// Check and install repo-required plugins (from baseline.json and baseline.project.json)
				if (config?.repos) {
					const { PluginInstaller } = await import(
						"../utils/plugin-installer.js"
					);
					const { ProjectConfigLoader } = await import(
						"../utils/project-config.js"
					);
					const lock =
						await PluginInstaller.loadLock(workspaceRoot);

					// Normalize repos before processing
					const { normalizeAllRepos } = await import(
						"../utils/config-helpers.js"
					);
					const normalizedRepos = await normalizeAllRepos(
						config.packages || config.repos,
						workspaceRoot
					);

					// Collect all required plugins from repos (baseline.json and baseline.project.json)
					for (const repo of normalizedRepos) {
						const repoPath = join(workspaceRoot, repo.path);

						// Check baseline.project.json for required plugins
						const projectConfig =
							ProjectConfigLoader.load(repoPath);
						if (projectConfig?.requiredPlugins) {
							for (const [
								pluginId,
								dependency,
							] of Object.entries(
								projectConfig.requiredPlugins
							)) {
								if (
									!lock.plugins[pluginId] &&
									!this.plugins.has(pluginId)
								) {
									try {
										Logger.debug(
											`Auto-installing plugin ${pluginId} required by ${repo.name}...`
										);
										const installed =
											await PluginInstaller.install(
												workspaceRoot,
												pluginId,
												dependency
											);
										lock.plugins[installed.id] =
											installed;
										await PluginInstaller.saveLock(
											workspaceRoot,
											lock
										);
										// Reload plugin after installation
										await this.discoverExternalPlugins(
											workspaceRoot
										);
									} catch (error) {
										Logger.warn(
											`Failed to auto-install plugin ${pluginId} required by ${repo.name}: ${error instanceof Error ? error.message : String(error)}`
										);
									}
								}
							}
						}

						// Check baseline.json repo.requiredPlugins (simple string array)
						if (repo.requiredPlugins) {
							for (const pluginId of repo.requiredPlugins) {
								if (
									!lock.plugins[pluginId] &&
									!this.plugins.has(pluginId)
								) {
									Logger.warn(
										`Repository ${repo.name} requires plugin ${pluginId} but it's not installed. Install it with: baseline plugin install ${pluginId}`
									);
								}
							}
						}
					}
				}
			}
		} catch {
			// ConfigManager might not be available or workspace not found
			// This is fine - external plugins are optional
		}
	}

	/**
	 * Register a plugin with the manager.
	 */
	registerPlugin(plugin: BaselinePlugin): void {
		if (this.plugins.has(plugin.metadata.id)) {
			Logger.warn(
				`Plugin ${plugin.metadata.id} is already registered. Overwriting.`
			);
		}
		this.plugins.set(plugin.metadata.id, plugin);
	}

	/**
	 * Get a plugin by ID.
	 */
	getPlugin(id: string): BaselinePlugin | undefined {
		return this.plugins.get(id);
	}

	/**
	 * Get all plugins of a specific type.
	 */
	getPluginsByType(
		type: BaselinePlugin["metadata"]["type"]
	): BaselinePlugin[] {
		return Array.from(this.plugins.values()).filter(
			(plugin) => plugin.metadata.type === type
		);
	}

	/**
	 * Get all language plugins.
	 */
	getLanguagePlugins(): LanguagePlugin[] {
		return this.getPluginsByType("language") as LanguagePlugin[];
	}

	/**
	 * Get language profile from a plugin.
	 */
	getLanguageProfile(
		pluginId: string,
		options?: LanguagePluginOptions
	): LanguageProfile | null {
		const plugin = this.getPlugin(pluginId);
		if (!plugin || plugin.metadata.type !== "language") {
			return null;
		}

		return (plugin as LanguagePlugin).getLanguageProfile(options);
	}

	/**
	 * Load all built-in plugins.
	 * Imports from the builtin index file.
	 */
	private async loadBuiltInPlugins(): Promise<void> {
		try {
			const { registerBuiltInPlugins } = await import(
				"./builtin/index.js"
			);
			registerBuiltInPlugins(this);
			Logger.debug("Loaded built-in plugins");
		} catch (error) {
			Logger.warn(
				`Failed to load built-in plugins: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Validate that an object is a valid plugin.
	 */
	private isValidPlugin(obj: any): obj is BaselinePlugin {
		return (
			obj &&
			typeof obj === "object" &&
			obj.metadata &&
			typeof obj.metadata.id === "string" &&
			typeof obj.metadata.name === "string" &&
			typeof obj.metadata.type === "string" &&
			[
				"language",
				"provider",
				"package-manager",
				"editor",
				"other",
			].includes(obj.metadata.type)
		);
	}

	/**
	 * Check if baseline version requirement is satisfied.
	 */
	private async checkBaselineVersion(
		requiredVersion?: string
	): Promise<boolean> {
		if (!requiredVersion) {
			return true; // No version requirement
		}

		try {
			// Get baseline version from package.json
			// Try to find package.json relative to this file's location
			const __filename = fileURLToPath(import.meta.url);
			const __dirname = dirname(__filename);
			let packageJsonPath = join(
				__dirname,
				"..",
				"..",
				"..",
				"package.json"
			);

			// If not found, try process.cwd()
			if (!existsSync(packageJsonPath)) {
				packageJsonPath = join(process.cwd(), "package.json");
			}

			if (existsSync(packageJsonPath)) {
				const packageJson = JSON.parse(
					readFileSync(packageJsonPath, "utf-8")
				);
				const currentVersion = packageJson.version || "0.1.0";

				// Simple semver comparison (basic check)
				// TODO: Use proper semver library for complex version ranges
				if (
					requiredVersion.startsWith("^") ||
					requiredVersion.startsWith("~")
				) {
					const requiredBase = requiredVersion.slice(1);
					const requiredMajor = parseInt(
						requiredBase.split(".")[0] || "0"
					);
					const currentMajor = parseInt(
						currentVersion.split(".")[0] || "0"
					);
					return currentMajor >= requiredMajor;
				}

				// Exact match or >= comparison
				if (requiredVersion.startsWith(">=")) {
					const requiredBase = requiredVersion.slice(2);
					return currentVersion >= requiredBase;
				}

				// For exact versions, require match
				return currentVersion === requiredVersion;
			}

			// If we can't check, allow it (might be in development)
			return true;
		} catch {
			// If we can't check, allow it (might be in development)
			return true;
		}
	}

	/**
	 * Check if plugin dependencies are satisfied.
	 */
	private checkDependencies(dependencies?: PluginRequirement[]): {
		satisfied: boolean;
		missing: string[];
	} {
		if (!dependencies || dependencies.length === 0) {
			return { satisfied: true, missing: [] };
		}

		const missing: string[] = [];
		for (const dep of dependencies) {
			if (!this.plugins.has(dep.pluginId)) {
				missing.push(dep.pluginId);
			}
		}

		return {
			satisfied: missing.length === 0,
			missing,
		};
	}

	/**
	 * Check if required languages are available.
	 */
	private checkRequiredLanguages(requiredLanguages?: string[]): {
		satisfied: boolean;
		missing: string[];
	} {
		if (!requiredLanguages || requiredLanguages.length === 0) {
			return { satisfied: true, missing: [] };
		}

		const missing: string[] = [];
		for (const langId of requiredLanguages) {
			const plugin = this.plugins.get(langId);
			if (!plugin || plugin.metadata.type !== "language") {
				missing.push(langId);
			}
		}

		return {
			satisfied: missing.length === 0,
			missing,
		};
	}

	/**
	 * Discover external plugins from workspace or global locations.
	 * Loads plugins from:
	 * - Installed plugins (.baseline/.plugins/)
	 * - User-managed plugins (.baseline/plugins/)
	 * - npm packages with "baseline-plugin" keyword (from package.json dependencies)
	 * - Remote plugin registry (TODO: full implementation)
	 */
	async discoverExternalPlugins(workspaceRoot?: string): Promise<void> {
		if (!workspaceRoot) {
			return;
		}

		// Load plugins from installed plugins directory (.baseline/.plugins/)
		const installedPluginsDir = join(
			workspaceRoot,
			".baseline",
			".plugins"
		);
		if (existsSync(installedPluginsDir)) {
			try {
				const entries = readdirSync(installedPluginsDir, {
					withFileTypes: true,
				});
				for (const entry of entries) {
					if (entry.isDirectory()) {
						await this.loadPluginFromDirectory(
							join(installedPluginsDir, entry.name),
							entry.name
						);
					} else if (entry.isFile()) {
						const ext = extname(entry.name);
						if (
							ext === ".js" ||
							ext === ".mjs" ||
							ext === ".cjs"
						) {
							await this.loadPluginFromFile(
								join(installedPluginsDir, entry.name),
								entry.name
							);
						}
					}
				}
			} catch (error) {
				Logger.warn(
					`Failed to read installed plugins directory: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		// Load plugins from .baseline/plugins/ directory (user-managed)
		const pluginsDir = join(workspaceRoot, ".baseline", "plugins");
		if (existsSync(pluginsDir)) {
			try {
				const entries = readdirSync(pluginsDir, {
					withFileTypes: true,
				});
				const loadPromises: Promise<void>[] = [];

				for (const entry of entries) {
					const entryPath = join(pluginsDir, entry.name);

					if (entry.isDirectory()) {
						// Directory might contain a plugin package
						loadPromises.push(
							this.loadPluginFromDirectory(
								entryPath,
								entry.name
							)
						);
					} else if (entry.isFile()) {
						// Single plugin file
						const ext = extname(entry.name);
						if (
							ext === ".js" ||
							ext === ".mjs" ||
							ext === ".cjs"
						) {
							loadPromises.push(
								this.loadPluginFromFile(
									entryPath,
									entry.name
								)
							);
						}
					}
				}

				await Promise.all(loadPromises);
			} catch (error) {
				Logger.warn(
					`Failed to read plugins directory: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		// Discover and load plugins from npm packages
		try {
			const { NpmPluginDiscovery } = await import(
				"../utils/npm-plugin-discovery.js"
			);
			const npmPlugins =
				await NpmPluginDiscovery.discoverFromDependencies(
					workspaceRoot
				);

			for (const npmPlugin of npmPlugins) {
				try {
					// Plugin is already installed in node_modules
					// Try to load it
					const nodeModulesPath = join(
						workspaceRoot,
						"node_modules",
						npmPlugin.name
					);
					const packageJsonPath = join(
						nodeModulesPath,
						"package.json"
					);

					if (existsSync(packageJsonPath)) {
						const packageJson = JSON.parse(
							readFileSync(packageJsonPath, "utf-8")
						);
						const pluginEntry =
							packageJson.baselinePlugin || "index.js";
						const pluginPath = join(
							nodeModulesPath,
							pluginEntry
						);

						if (existsSync(pluginPath)) {
							const pluginUrl =
								pathToFileURL(pluginPath).href;
							const pluginModule = await import(
								`${pluginUrl}?${Date.now()}`
							);
							const pluginOrPackage =
								pluginModule.default ||
								pluginModule.plugin ||
								pluginModule.package;

							if (
								this.isValidPluginPackage(pluginOrPackage)
							) {
								await this.registerPluginPackage(
									pluginOrPackage,
									`npm:${npmPlugin.name}`
								);
							} else if (
								this.isValidPlugin(pluginOrPackage)
							) {
								await this.registerPluginWithChecks(
									pluginOrPackage,
									`npm:${npmPlugin.name}`
								);
							}
						}
					}
				} catch (error) {
					Logger.debug(
						`Failed to load npm plugin ${npmPlugin.name}: ${error instanceof Error ? error.message : String(error)}`
					);
				}
			}
		} catch (error) {
			Logger.debug(
				`Failed to discover npm plugins: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Load a single plugin from a file.
	 */
	private async loadPluginFromFile(
		filePath: string,
		fileName: string
	): Promise<void> {
		try {
			const pluginUrl = pathToFileURL(filePath).href;
			const pluginModule = await import(
				`${pluginUrl}?${Date.now()}`
			);
			const pluginOrPackage =
				pluginModule.default ||
				pluginModule.plugin ||
				pluginModule.package;

			if (this.isValidPluginPackage(pluginOrPackage)) {
				// It's a plugin package
				await this.registerPluginPackage(
					pluginOrPackage,
					fileName
				);
			} else if (this.isValidPlugin(pluginOrPackage)) {
				// It's a single plugin
				await this.registerPluginWithChecks(
					pluginOrPackage,
					fileName
				);
			} else {
				Logger.warn(
					`Invalid plugin format in ${fileName}: missing required metadata or structure`
				);
			}
		} catch (error) {
			Logger.warn(
				`Failed to load external plugin ${fileName}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Load a plugin package from a directory.
	 */
	private async loadPluginFromDirectory(
		dirPath: string,
		dirName: string
	): Promise<void> {
		// Look for index.js, index.mjs, or package.json with main entry
		const possibleEntries = [
			join(dirPath, "index.js"),
			join(dirPath, "index.mjs"),
			join(dirPath, "index.cjs"),
			join(dirPath, "plugin.js"),
			join(dirPath, "plugin.mjs"),
			join(dirPath, "plugin.cjs"),
		];

		// Also check for package.json
		const packageJsonPath = join(dirPath, "package.json");
		if (existsSync(packageJsonPath)) {
			try {
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf-8")
				);
				if (packageJson.main) {
					possibleEntries.unshift(
						join(dirPath, packageJson.main)
					);
				}
			} catch {
				// Failed to parse package.json
			}
		}

		for (const entryPath of possibleEntries) {
			if (existsSync(entryPath)) {
				await this.loadPluginFromFile(entryPath, dirName);
				return;
			}
		}

		Logger.debug(`No plugin entry found in directory ${dirName}`);
	}

	/**
	 * Register a plugin with dependency and version checks.
	 */
	private async registerPluginWithChecks(
		plugin: BaselinePlugin,
		source: string
	): Promise<void> {
		// Check baseline version requirement
		if (
			!(await this.checkBaselineVersion(
				plugin.metadata.baselineVersion
			))
		) {
			Logger.warn(
				`Plugin ${plugin.metadata.id} requires baseline version ${plugin.metadata.baselineVersion}, skipping`
			);
			return;
		}

		// Check dependencies
		const depCheck = this.checkDependencies(plugin.metadata.requires);
		if (!depCheck.satisfied) {
			Logger.warn(
				`Plugin ${plugin.metadata.id} requires missing plugins: ${depCheck.missing.join(", ")}, skipping`
			);
			return;
		}

		// Check required languages
		const langCheck = this.checkRequiredLanguages(
			plugin.metadata.requiresLanguages
		);
		if (!langCheck.satisfied) {
			Logger.warn(
				`Plugin ${plugin.metadata.id} requires missing languages: ${langCheck.missing.join(", ")}, skipping`
			);
			return;
		}

		// Check if plugin is already registered (don't overwrite built-ins)
		if (!this.plugins.has(plugin.metadata.id)) {
			this.registerPlugin(plugin);
			Logger.debug(
				`Loaded external plugin: ${plugin.metadata.id} from ${source}`
			);
		} else {
			Logger.debug(
				`Skipping external plugin ${plugin.metadata.id} (already registered as built-in)`
			);
		}
	}

	/**
	 * Register a plugin package (multiple plugins).
	 */
	private async registerPluginPackage(
		pluginPackage: PluginPackage,
		source: string
	): Promise<void> {
		// Check baseline version requirement
		if (
			!(await this.checkBaselineVersion(
				pluginPackage.metadata.baselineVersion
			))
		) {
			Logger.warn(
				`Plugin package ${pluginPackage.metadata.name} requires baseline version ${pluginPackage.metadata.baselineVersion}, skipping`
			);
			return;
		}

		// Check package dependencies
		const depCheck = this.checkDependencies(
			pluginPackage.dependencies
		);
		if (!depCheck.satisfied) {
			Logger.warn(
				`Plugin package ${pluginPackage.metadata.name} requires missing plugins: ${depCheck.missing.join(", ")}, skipping`
			);
			return;
		}

		// Check required languages
		const langCheck = this.checkRequiredLanguages(
			pluginPackage.requiresLanguages
		);
		if (!langCheck.satisfied) {
			Logger.warn(
				`Plugin package ${pluginPackage.metadata.name} requires missing languages: ${langCheck.missing.join(", ")}, skipping`
			);
			return;
		}

		// Register all plugins in the package
		for (const plugin of pluginPackage.plugins) {
			await this.registerPluginWithChecks(
				plugin,
				`${pluginPackage.metadata.name} (from ${source})`
			);
		}
	}

	/**
	 * Validate that an object is a valid plugin package.
	 */
	private isValidPluginPackage(obj: any): obj is PluginPackage {
		return (
			obj &&
			typeof obj === "object" &&
			obj.metadata &&
			typeof obj.metadata.name === "string" &&
			typeof obj.metadata.version === "string" &&
			Array.isArray(obj.plugins) &&
			obj.plugins.every((p: any) => this.isValidPlugin(p))
		);
	}
}
