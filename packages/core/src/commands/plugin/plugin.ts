import { ConfigManager } from "../../config/manager.js";
import { PluginInstaller } from "../../utils/plugin-installer.js";
import { PluginManager } from "../../plugins/manager.js";
import { PluginDependency } from "../../types/config.js";

export interface PluginInstallOptions {
	version?: string;
	source?: "npm" | "git" | "local" | "remote";
	url?: string;
	path?: string;
	save?: boolean;
	workspaceRoot?: string;
}

export interface PluginInstallResult {
	success: boolean;
	pluginId: string;
	pluginVersion?: string;
	addedToConfig: boolean;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
}

export interface PluginListResult {
	success: boolean;
	plugins: Array<{
		id: string;
		version: string;
		source: string;
		location: string;
		installedAt: string;
	}>;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
}

export interface PluginRemoveResult {
	success: boolean;
	pluginId: string;
	removedFromConfig: boolean;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
}

export interface PluginInstallAllResult {
	success: boolean;
	installed: number;
	failed: number;
	plugins: Array<{ id: string; version: string; success: boolean; error?: string }>;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
}

export interface PluginSearchResult {
	success: boolean;
	plugins: Array<{
		id: string;
		name: string;
		version: string;
		description?: string;
		source: string;
		requiresLanguages?: string[];
	}>;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
}

/**
 * Install a plugin.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function installPlugin(
	pluginId: string,
	options: PluginInstallOptions = {}
): Promise<PluginInstallResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			pluginId,
			addedToConfig: false,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	try {
		// Build dependency spec
		const dependency: PluginDependency = {
			version: options.version,
			source: options.source,
			url:
				options.url ||
				(options.source === "npm" ? pluginId : undefined),
			path: options.path,
		};

		// Infer source if not specified
		if (!dependency.source) {
			if (
				options.url?.startsWith("git+") ||
				options.url?.endsWith(".git")
			) {
				dependency.source = "git";
				dependency.url = options.url;
			} else if (
				options.url?.startsWith("http://") ||
				options.url?.startsWith("https://")
			) {
				dependency.source = "remote";
				dependency.url = options.url;
			} else if (options.path) {
				dependency.source = "local";
				dependency.path = options.path;
			} else {
				dependency.source = "npm";
				dependency.url = pluginId;
			}
		}

		messages.push({ type: "info", message: `Installing Plugin: ${pluginId}` });

		// Install the plugin
		const installed = await PluginInstaller.install(
			workspaceRoot,
			pluginId,
			dependency
		);

		// Update lock file
		const lock = await PluginInstaller.loadLock(workspaceRoot);
		lock.plugins[installed.id] = installed;
		await PluginInstaller.saveLock(workspaceRoot, lock);

		let addedToConfig = false;
		// Save to baseline.json if requested
		if (options.save !== false) {
			if (!config.plugins) {
				config.plugins = {};
			}
			if (!config.plugins.dependencies) {
				config.plugins.dependencies = {};
			}
			config.plugins.dependencies[installed.id] = dependency;
			await configManager.save(config);
			addedToConfig = true;
			messages.push({ type: "success", message: `Added ${installed.id} to baseline.json` });
		}

		messages.push({ type: "success", message: `Installed plugin: ${installed.id}@${installed.version}` });

		// Try to load the plugin
		messages.push({ type: "info", message: "Loading plugin..." });
		const pluginManager = PluginManager.getInstance();
		await pluginManager.initialize();
		const pluginPath = await PluginInstaller.getPluginPath(
			workspaceRoot,
			installed.id
		);
		if (pluginPath) {
			await pluginManager.discoverExternalPlugins(workspaceRoot);
			messages.push({ type: "success", message: "Plugin loaded successfully" });
		}

		return {
			success: true,
			pluginId: installed.id,
			pluginVersion: installed.version,
			addedToConfig,
			messages,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		messages.push({ type: "error", message: `Failed to install plugin: ${errorMsg}` });
		return {
			success: false,
			pluginId,
			addedToConfig: false,
			messages,
		};
	}
}

/**
 * List installed plugins.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function listPlugins(
	options: { workspaceRoot?: string } = {}
): Promise<PluginListResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			plugins: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	messages.push({ type: "info", message: "Installed Plugins" });

	const installed = await PluginInstaller.listInstalled(workspaceRoot);

	if (installed.length === 0) {
		messages.push({ type: "info", message: "No plugins installed." });
		return {
			success: true,
			plugins: [],
			messages,
		};
	}

	for (const plugin of installed) {
		messages.push({ type: "info", message: `${plugin.id}@${plugin.version} (${plugin.source})` });
		messages.push({ type: "dim", message: `  Location: ${plugin.location}` });
		messages.push({ type: "dim", message: `  Installed: ${new Date(plugin.installedAt).toLocaleDateString()}` });
	}

	return {
		success: true,
		plugins: installed,
		messages,
	};
}

/**
 * Remove a plugin.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function removePlugin(
	pluginId: string,
	options: { removeFromConfig?: boolean; workspaceRoot?: string } = {}
): Promise<PluginRemoveResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			pluginId,
			removedFromConfig: false,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	try {
		messages.push({ type: "info", message: `Removing Plugin: ${pluginId}` });

		await PluginInstaller.remove(workspaceRoot, pluginId);

		let removedFromConfig = false;
		// Remove from baseline.json if requested
		if (
			options.removeFromConfig !== false &&
			config.plugins?.dependencies
		) {
			delete config.plugins.dependencies[pluginId];
			await configManager.save(config);
			removedFromConfig = true;
			messages.push({ type: "success", message: `Removed ${pluginId} from baseline.json` });
		}

		return {
			success: true,
			pluginId,
			removedFromConfig,
			messages,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		messages.push({ type: "error", message: `Failed to remove plugin: ${errorMsg}` });
		return {
			success: false,
			pluginId,
			removedFromConfig: false,
			messages,
		};
	}
}

/**
 * Install all plugins from baseline.json dependencies.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function installAllPlugins(
	options: { workspaceRoot?: string } = {}
): Promise<PluginInstallAllResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	const plugins: Array<{ id: string; version: string; success: boolean; error?: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			installed: 0,
			failed: 0,
			plugins: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	if (
		!config.plugins?.dependencies ||
		Object.keys(config.plugins.dependencies).length === 0
	) {
		messages.push({ type: "info", message: "No plugin dependencies found in baseline.json" });
		return {
			success: true,
			installed: 0,
			failed: 0,
			plugins: [],
			messages,
		};
	}

	messages.push({ type: "info", message: "Installing All Plugin Dependencies" });

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	let installed = 0;
	let failed = 0;

	for (const [pluginId, dependency] of Object.entries(
		config.plugins.dependencies
	)) {
		try {
			messages.push({ type: "info", message: `Installing ${pluginId}...` });
			const installedPlugin = await PluginInstaller.install(
				workspaceRoot,
				pluginId,
				dependency
			);

			// Update lock file
			const lock = await PluginInstaller.loadLock(workspaceRoot);
			lock.plugins[installedPlugin.id] = installedPlugin;
			await PluginInstaller.saveLock(workspaceRoot, lock);

			installed++;
			plugins.push({
				id: installedPlugin.id,
				version: installedPlugin.version,
				success: true,
			});
			messages.push({ type: "success", message: `Installed ${installedPlugin.id}@${installedPlugin.version}` });
		} catch (error) {
			failed++;
			const errorMsg = error instanceof Error ? error.message : String(error);
			plugins.push({
				id: pluginId,
				version: "unknown",
				success: false,
				error: errorMsg,
			});
			messages.push({ type: "error", message: `Failed to install ${pluginId}: ${errorMsg}` });
		}
	}

	// Reload all plugins
	messages.push({ type: "info", message: "Loading all plugins..." });
	await pluginManager.discoverExternalPlugins(workspaceRoot);
	messages.push({ type: "success", message: "All plugins installed and loaded" });

	return {
		success: failed === 0,
		installed,
		failed,
		plugins,
		messages,
	};
}

/**
 * Search for plugins in npm registry.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function searchPlugins(
	query: string,
	options: { registry?: boolean; workspaceRoot?: string } = {}
): Promise<PluginSearchResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	const plugins: Array<{
		id: string;
		name: string;
		version: string;
		description?: string;
		source: string;
		requiresLanguages?: string[];
	}> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			plugins: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	messages.push({ type: "info", message: `Searching for plugins: "${query}"` });

	if (options.registry) {
		// Search plugin registry
		try {
			const { PluginRegistryClient } = await import(
				"../../utils/plugin-registry.js"
			);
			const results = await PluginRegistryClient.search(
				workspaceRoot,
				query
			);

			if (results.length === 0) {
				messages.push({ type: "info", message: "No plugins found in registry." });
				return {
					success: true,
					plugins: [],
					messages,
				};
			}

			messages.push({ type: "info", message: `Found ${results.length} plugin(s):` });

			for (const plugin of results) {
				plugins.push({
					id: plugin.id,
					name: plugin.name,
					version: plugin.version,
					description: plugin.description,
					source: plugin.source,
					requiresLanguages: plugin.requiresLanguages,
				});
				messages.push({ type: "info", message: `${plugin.name}@${plugin.version}` });
				if (plugin.description) {
					messages.push({ type: "dim", message: `  ${plugin.description}` });
				}
				messages.push({ type: "dim", message: `  Source: ${plugin.source}` });
				messages.push({ type: "dim", message: `  ID: ${plugin.id}` });
				if (
					plugin.requiresLanguages &&
					plugin.requiresLanguages.length > 0
				) {
					messages.push({ type: "dim", message: `  Requires languages: ${plugin.requiresLanguages.join(", ")}` });
				}
				messages.push({ type: "info", message: "" });
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed to search registry: ${errorMsg}` });
			return {
				success: false,
				plugins: [],
				messages,
			};
		}
	} else {
		// Search npm
		try {
			const { NpmPluginDiscovery } = await import(
				"../../utils/npm-plugin-discovery.js"
			);
			const results = await NpmPluginDiscovery.search(query);

			if (results.length === 0) {
				messages.push({ type: "info", message: "No plugins found on npm." });
				return {
					success: true,
					plugins: [],
					messages,
				};
			}

			messages.push({ type: "info", message: `Found ${results.length} plugin(s) on npm:` });

			for (const plugin of results) {
				plugins.push({
					id: plugin.name,
					name: plugin.name,
					version: plugin.version,
					description: plugin.description,
					source: "npm",
				});
				messages.push({ type: "info", message: `${plugin.name}@${plugin.version}` });
				if (plugin.description) {
					messages.push({ type: "dim", message: `  ${plugin.description}` });
				}
				messages.push({ type: "info", message: "" });
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed to search npm: ${errorMsg}` });
			return {
				success: false,
				plugins: [],
				messages,
			};
		}
	}

	return {
		success: true,
		plugins,
		messages,
	};
}
