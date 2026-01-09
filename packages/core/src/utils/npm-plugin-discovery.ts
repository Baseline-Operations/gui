import { execa } from "execa";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";
import { Logger } from "./logger.js";

export interface NpmPluginInfo {
	name: string;
	version: string;
	description?: string;
	baselinePluginId?: string;
	baselinePlugin?: string;
	keywords?: string[];
}

/**
 * Discover baseline plugins from npm packages.
 * Searches for packages with "baseline-plugin" keyword.
 */
export class NpmPluginDiscovery {
	/**
	 * Search npm for baseline plugins.
	 */
	static async search(query?: string): Promise<NpmPluginInfo[]> {
		try {
			Logger.debug("Searching npm for baseline plugins...");
			const searchQuery = query
				? `keywords:baseline-plugin ${query}`
				: "keywords:baseline-plugin";
			
			const { stdout } = await execa(
				"npm",
				["search", "--json", searchQuery],
				{
					timeout: 30000,
					stdio: "pipe",
				}
			);

			const results = JSON.parse(stdout);
			if (!Array.isArray(results)) {
				return [];
			}

			return results
				.filter((pkg: any) =>
					pkg.keywords?.includes("baseline-plugin")
				)
				.map((pkg: any) => ({
					name: pkg.name,
					version: pkg.version,
					description: pkg.description,
					keywords: pkg.keywords,
				}));
		} catch (error) {
			Logger.warn(
				`Failed to search npm: ${error instanceof Error ? error.message : String(error)}`
			);
			return [];
		}
	}

	/**
	 * Get plugin information from installed npm package.
	 */
	static async getPluginInfo(
		packageName: string,
		workspaceRoot: string
	): Promise<NpmPluginInfo | null> {
		try {
			// Check node_modules in workspace root
			const nodeModulesPath = join(workspaceRoot, "node_modules", packageName);
			if (existsSync(nodeModulesPath)) {
				const packageJsonPath = join(nodeModulesPath, "package.json");
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf-8")
				);

				if (!packageJson.keywords?.includes("baseline-plugin")) {
					return null;
				}

				return {
					name: packageJson.name,
					version: packageJson.version,
					description: packageJson.description,
					baselinePluginId: packageJson.baselinePluginId,
					baselinePlugin: packageJson.baselinePlugin,
					keywords: packageJson.keywords,
				};
			}

			// Try to get info from npm registry
			const { stdout } = await execa(
				"npm",
				["view", packageName, "name", "version", "description", "keywords", "baselinePluginId", "baselinePlugin", "--json"],
				{
					timeout: 10000,
					stdio: "pipe",
				}
			);

			const info = JSON.parse(stdout);
			if (!info.keywords?.includes("baseline-plugin")) {
				return null;
			}

			return {
				name: info.name,
				version: info.version,
				description: info.description,
				baselinePluginId: info.baselinePluginId,
				baselinePlugin: info.baselinePlugin,
				keywords: info.keywords,
			};
		} catch (error) {
			Logger.debug(
				`Failed to get npm plugin info for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
			);
			return null;
		}
	}

	/**
	 * Discover baseline plugins from package.json dependencies.
	 */
	static async discoverFromDependencies(
		workspaceRoot: string
	): Promise<NpmPluginInfo[]> {
		const packageJsonPath = join(workspaceRoot, "package.json");
		if (!existsSync(packageJsonPath)) {
			return [];
		}

		try {
			const packageJson = JSON.parse(
				await readFile(packageJsonPath, "utf-8")
			);

			const allDeps = {
				...packageJson.dependencies,
				...packageJson.devDependencies,
				...packageJson.peerDependencies,
			};

			const plugins: NpmPluginInfo[] = [];

			for (const [depName] of Object.entries(allDeps)) {
				const info = await this.getPluginInfo(depName, workspaceRoot);
				if (info) {
					plugins.push(info);
				}
			}

			return plugins;
		} catch (error) {
			Logger.warn(
				`Failed to discover plugins from dependencies: ${error instanceof Error ? error.message : String(error)}`
			);
			return [];
		}
	}
}

