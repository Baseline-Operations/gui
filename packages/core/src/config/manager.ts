import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { BaselineConfig, BaselineConfigSchema, Package } from "../types/config.js";

/** Name of the baseline configuration file */
export const BASELINE_CONFIG_FILE = "baseline.json";

/** Name of the baseline directory (currently unused, reserved for future use) */
export const BASELINE_DIR = ".baseline";

/**
 * Manages loading, saving, and validating baseline workspace configuration.
 * Configuration is stored in a `baseline.json` file at the workspace root.
 */
export class ConfigManager {
	private workspaceRoot: string;
	private configPath: string;

	/**
	 * Create a new ConfigManager instance.
	 *
	 * @param workspaceRoot - Path to the workspace root directory (defaults to current working directory)
	 */
	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot;
		this.configPath = join(workspaceRoot, BASELINE_CONFIG_FILE);
	}

	/**
	 * Load and validate the baseline configuration file.
	 *
	 * @returns Parsed and validated configuration, or null if file doesn't exist
	 * @throws Error if file exists but cannot be parsed or validated
	 *
	 * @example
	 * ```ts
	 * const manager = new ConfigManager();
	 * const config = await manager.load();
	 * if (config) {
	 *   console.log(`Workspace: ${config.name}`);
	 * }
	 * ```
	 */
	async load(): Promise<BaselineConfig | null> {
		if (!existsSync(this.configPath)) {
			return null;
		}

		try {
			const content = await readFile(this.configPath, "utf-8");
			const json = JSON.parse(content);
			const config = BaselineConfigSchema.parse(json);
			
			// Handle backward compatibility: if repos exists but packages doesn't, migrate
			if (config.packages || config.repos && !config.packages) {
				config.packages = config.packages || config.repos;
			}
			
			return config;
		} catch (error) {
			throw new Error(
				`Failed to load baseline config: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Get packages from config with backward compatibility for repos.
	 */
	getPackages(config: BaselineConfig): Package[] {
		return config.packages || config.repos || [];
	}

	/**
	 * Save the baseline configuration to disk.
	 *
	 * @param config - Configuration object to save
	 * @throws Error if file cannot be written
	 *
	 * @example
	 * ```ts
	 * const config: BaselineConfig = { ... };
	 * await manager.save(config);
	 * ```
	 */
	async save(config: BaselineConfig): Promise<void> {
		try {
			const content = JSON.stringify(config, null, 2);
			await writeFile(this.configPath, content + "\n", "utf-8");
		} catch (error) {
			throw new Error(
				`Failed to save baseline config: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Check if the baseline configuration file exists.
	 *
	 * @returns True if config file exists, false otherwise
	 */
	exists(): boolean {
		return existsSync(this.configPath);
	}

	/**
	 * Get the workspace root directory path.
	 *
	 * @returns Absolute path to the workspace root
	 */
	getWorkspaceRoot(): string {
		return this.workspaceRoot;
	}

	/**
	 * Get the absolute path to the configuration file.
	 *
	 * @returns Absolute path to baseline.json
	 */
	getConfigPath(): string {
		return this.configPath;
	}

	/**
	 * Find the workspace root directory by traversing up from the given path.
	 * Looks for a `baseline.json` file in the current directory and parent directories.
	 *
	 * @param startPath - Path to start searching from (defaults to current working directory)
	 * @returns Absolute path to workspace root, or null if not found
	 *
	 * @example
	 * ```ts
	 * const root = ConfigManager.findWorkspaceRoot("/some/deep/path");
	 * if (root) {
	 *   console.log(`Found workspace at: ${root}`);
	 * }
	 * ```
	 */
	static findWorkspaceRoot(
		startPath: string = process.cwd()
	): string | null {
		let current = startPath;
		const root = process.platform === "win32" ? "C:\\" : "/";

		while (current !== root) {
			const configPath = join(current, BASELINE_CONFIG_FILE);
			if (existsSync(configPath)) {
				return current;
			}
			const parent = join(current, "..");
			if (parent === current) break; // Reached root
			current = parent;
		}

		return null;
	}
}
