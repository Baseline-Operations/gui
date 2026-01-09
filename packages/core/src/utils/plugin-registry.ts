import { execa } from "execa";
import { Logger } from "./logger.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export interface PluginRegistryEntry {
	id: string;
	name: string;
	version: string;
	description?: string;
	author?: string;
	source: "npm" | "git" | "remote";
	location: string;
	keywords?: string[];
	baselineVersion?: string;
	requires?: string[];
	requiresLanguages?: string[];
}

export interface PluginRegistry {
	plugins: PluginRegistryEntry[];
	version: string;
	updatedAt: string;
}

/**
 * Plugin registry client for discovering and installing plugins from remote registry.
 */
export class PluginRegistryClient {
	private static readonly DEFAULT_REGISTRY_URL =
		"https://registry.baseline.dev/plugins";
	private static readonly REGISTRY_CACHE_FILE = ".baseline/.registry-cache.json";
	private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

	/**
	 * Get registry URL from config or environment variable.
	 */
	static getRegistryUrl(_workspaceRoot: string): string {
		// TODO: Check baseline.json for custom registry URL
		// For now, check environment variable
		return process.env.BASELINE_PLUGIN_REGISTRY || this.DEFAULT_REGISTRY_URL;
	}

	/**
	 * Load cached registry data.
	 */
	static async loadCache(workspaceRoot: string): Promise<PluginRegistry | null> {
		const cachePath = join(workspaceRoot, this.REGISTRY_CACHE_FILE);
		if (!existsSync(cachePath)) {
			return null;
		}

		try {
			const content = await readFile(cachePath, "utf-8");
			const cache = JSON.parse(content);
			const age = Date.now() - new Date(cache.updatedAt).getTime();
			if (age > this.CACHE_TTL) {
				return null; // Cache expired
			}
			return cache;
		} catch {
			return null;
		}
	}

	/**
	 * Save registry data to cache.
	 */
	static async saveCache(
		workspaceRoot: string,
		registry: PluginRegistry
	): Promise<void> {
		const cachePath = join(workspaceRoot, this.REGISTRY_CACHE_FILE);
		await mkdir(join(workspaceRoot, ".baseline"), { recursive: true });
		await writeFile(cachePath, JSON.stringify(registry, null, 2) + "\n");
	}

	/**
	 * Fetch plugin registry from remote URL.
	 */
	static async fetchRegistry(
		workspaceRoot: string,
		registryUrl?: string
	): Promise<PluginRegistry> {
		const url = registryUrl || this.getRegistryUrl(workspaceRoot);
		Logger.debug(`Fetching plugin registry from ${url}...`);

		try {
			// Try fetch first (Node.js 18+)
			try {
				const response = await fetch(url);
				if (!response.ok) {
					throw new Error(`Registry request failed: ${response.statusText}`);
				}
				const data = (await response.json()) as any;
				const registry: PluginRegistry = {
					plugins: data.plugins || [],
					version: data.version || "1.0.0",
					updatedAt: new Date().toISOString(),
				};
				await this.saveCache(workspaceRoot, registry);
				return registry;
			} catch {
				// Fallback to curl
				const { stdout } = await execa("curl", ["-L", "-s", url], {
					timeout: 10000,
				});
				const data = JSON.parse(stdout) as any;
				const registry: PluginRegistry = {
					plugins: data.plugins || [],
					version: data.version || "1.0.0",
					updatedAt: new Date().toISOString(),
				};
				await this.saveCache(workspaceRoot, registry);
				return registry;
			}
		} catch (error) {
			Logger.warn(
				`Failed to fetch plugin registry: ${error instanceof Error ? error.message : String(error)}`
			);
			// Try to return cached data
			const cache = await this.loadCache(workspaceRoot);
			if (cache) {
				Logger.info("Using cached registry data");
				return cache;
			}
			throw error;
		}
	}

	/**
	 * Get plugin registry (cached or fresh).
	 */
	static async getRegistry(
		workspaceRoot: string,
		forceRefresh: boolean = false
	): Promise<PluginRegistry> {
		if (!forceRefresh) {
			const cache = await this.loadCache(workspaceRoot);
			if (cache) {
				return cache;
			}
		}

		return this.fetchRegistry(workspaceRoot);
	}

	/**
	 * Search plugins in registry.
	 */
	static async search(
		workspaceRoot: string,
		query: string
	): Promise<PluginRegistryEntry[]> {
		const registry = await this.getRegistry(workspaceRoot);
		const lowerQuery = query.toLowerCase();

		return registry.plugins.filter(
			(plugin) =>
				plugin.id.toLowerCase().includes(lowerQuery) ||
				plugin.name.toLowerCase().includes(lowerQuery) ||
				plugin.description?.toLowerCase().includes(lowerQuery) ||
				plugin.keywords?.some((k) => k.toLowerCase().includes(lowerQuery))
		);
	}

	/**
	 * Get plugin by ID.
	 */
	static async getPlugin(
		workspaceRoot: string,
		pluginId: string
	): Promise<PluginRegistryEntry | null> {
		const registry = await this.getRegistry(workspaceRoot);
		return registry.plugins.find((p) => p.id === pluginId) || null;
	}
}

