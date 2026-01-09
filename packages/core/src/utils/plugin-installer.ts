import { existsSync, statSync } from "fs";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { join, dirname, basename } from "path";
import { execa } from "execa";
import { Logger } from "./logger.js";
import { PluginDependency } from "../types/config.js";

/**
 * Plugin installation directory (git-ignored)
 */
export const PLUGIN_INSTALL_DIR = ".baseline/.plugins";

/**
 * Plugin lock file to track installed versions
 */
export const PLUGIN_LOCK_FILE = ".baseline/.plugins.lock.json";

export interface InstalledPlugin {
	id: string;
	version: string;
	source: "npm" | "git" | "local" | "remote";
	location: string; // Path or URL
	installedAt: string;
}

export interface PluginLock {
	plugins: Record<string, InstalledPlugin>;
	version: string;
}

/**
 * Install a plugin from various sources.
 */
export class PluginInstaller {
	/**
	 * Get the plugin installation directory path.
	 */
	static getPluginDir(workspaceRoot: string): string {
		return join(workspaceRoot, PLUGIN_INSTALL_DIR);
	}

	/**
	 * Get the plugin lock file path.
	 */
	static getLockFile(workspaceRoot: string): string {
		return join(workspaceRoot, PLUGIN_LOCK_FILE);
	}

	/**
	 * Load the plugin lock file.
	 */
	static async loadLock(workspaceRoot: string): Promise<PluginLock> {
		const lockPath = this.getLockFile(workspaceRoot);
		if (!existsSync(lockPath)) {
			return { plugins: {}, version: "1.0.0" };
		}

		try {
			const content = await readFile(lockPath, "utf-8");
			return JSON.parse(content);
		} catch {
			return { plugins: {}, version: "1.0.0" };
		}
	}

	/**
	 * Save the plugin lock file.
	 */
	static async saveLock(
		workspaceRoot: string,
		lock: PluginLock
	): Promise<void> {
		const lockPath = this.getLockFile(workspaceRoot);
		await mkdir(dirname(lockPath), { recursive: true });
		await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n");
	}

	/**
	 * Install a plugin from npm.
	 */
	static async installFromNpm(
		workspaceRoot: string,
		packageName: string,
		version?: string
	): Promise<InstalledPlugin> {
		const pluginDir = this.getPluginDir(workspaceRoot);
		await mkdir(pluginDir, { recursive: true });

		Logger.info(`Installing ${packageName}${version ? `@${version}` : ""} from npm...`);

		// Create a temporary directory for npm install
		const tempDir = join(pluginDir, `.tmp-${Date.now()}`);
		await mkdir(tempDir, { recursive: true });

		try {
			// Install npm package
			const installArgs = ["install", packageName];
			if (version) {
				installArgs.push(version);
			}

			await execa("npm", installArgs, {
				cwd: tempDir,
				stdio: "pipe",
			});

			// Find the installed package
			const nodeModulesPath = join(tempDir, "node_modules", packageName);
			if (!existsSync(nodeModulesPath)) {
				throw new Error(`Package ${packageName} not found after installation`);
			}

			// Read package.json to get version
			const packageJsonPath = join(nodeModulesPath, "package.json");
			const packageJson = JSON.parse(
				await readFile(packageJsonPath, "utf-8")
			);
			const installedVersion = packageJson.version || version || "latest";

			// Copy to plugin directory
			const pluginInstallPath = join(
				pluginDir,
				`${packageName}-${installedVersion}`
			);
			await mkdir(pluginInstallPath, { recursive: true });

			// Copy the entire package (plugins might have dependencies)
			await execa("cp", ["-r", nodeModulesPath + "/*", pluginInstallPath], {
				shell: true,
			});

			// Clean up temp directory
			await execa("rm", ["-rf", tempDir], { shell: true });

			return {
				id: packageJson.baselinePluginId || packageName,
				version: installedVersion,
				source: "npm",
				location: packageName,
				installedAt: new Date().toISOString(),
			};
		} catch (error) {
			// Clean up on error
			try {
				await execa("rm", ["-rf", tempDir], { shell: true });
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Install a plugin from a Git URL.
	 */
	static async installFromGit(
		workspaceRoot: string,
		gitUrl: string,
		version?: string
	): Promise<InstalledPlugin> {
		const pluginDir = this.getPluginDir(workspaceRoot);
		await mkdir(pluginDir, { recursive: true });

		Logger.info(`Installing plugin from Git: ${gitUrl}${version ? ` (${version})` : ""}...`);

		// Extract repo name from URL
		const repoName = basename(gitUrl, ".git").replace(/[^a-zA-Z0-9-]/g, "-");
		const installPath = join(pluginDir, repoName);

		// Clone or update the repository
		if (existsSync(installPath)) {
			Logger.debug(`Updating existing clone at ${installPath}`);
			await execa("git", ["pull"], { cwd: installPath });
		} else {
			await execa("git", ["clone", gitUrl, installPath]);
		}

		// Checkout specific version if provided
		if (version) {
			await execa("git", ["checkout", version], { cwd: installPath });
		}

		// Try to read package.json or plugin metadata
		let pluginId = repoName;
		let pluginVersion = version || "latest";

		const packageJsonPath = join(installPath, "package.json");
		if (existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(
				await readFile(packageJsonPath, "utf-8")
			);
			pluginId = packageJson.baselinePluginId || pluginId;
			pluginVersion = packageJson.version || pluginVersion;
		}

		return {
			id: pluginId,
			version: pluginVersion,
			source: "git",
			location: gitUrl,
			installedAt: new Date().toISOString(),
		};
	}

	/**
	 * Install a plugin from a local path.
	 */
	static async installFromLocal(
		workspaceRoot: string,
		localPath: string
	): Promise<InstalledPlugin> {
		const pluginDir = this.getPluginDir(workspaceRoot);
		await mkdir(pluginDir, { recursive: true });

		Logger.info(`Installing plugin from local path: ${localPath}...`);

		const resolvedPath = join(process.cwd(), localPath);
		if (!existsSync(resolvedPath)) {
			throw new Error(`Local path not found: ${localPath}`);
		}

		const statInfoSync = statSync(resolvedPath);
		const pluginName = basename(resolvedPath);

		// Create symlink or copy
		const installPath = join(pluginDir, pluginName);

		if (statInfoSync.isDirectory()) {
			// Symlink directory
			await execa("ln", ["-sf", resolvedPath, installPath], {
				shell: true,
			});
		} else {
			// Copy file
			await execa("cp", [resolvedPath, installPath], { shell: true });
		}

		// Try to read plugin metadata
		let pluginId = pluginName;
		let pluginVersion = "1.0.0";

		if (statInfoSync.isDirectory()) {
			const packageJsonPath = join(resolvedPath, "package.json");
			if (existsSync(packageJsonPath)) {
				const packageJson = JSON.parse(
					await readFile(packageJsonPath, "utf-8")
				);
				pluginId = packageJson.baselinePluginId || pluginId;
				pluginVersion = packageJson.version || pluginVersion;
			}
		}

		return {
			id: pluginId,
			version: pluginVersion,
			source: "local",
			location: localPath,
			installedAt: new Date().toISOString(),
		};
	}

	/**
	 * Install a plugin from a remote URL (direct download).
	 */
	static async installFromRemote(
		workspaceRoot: string,
		url: string
	): Promise<InstalledPlugin> {
		const pluginDir = this.getPluginDir(workspaceRoot);
		await mkdir(pluginDir, { recursive: true });

		Logger.info(`Installing plugin from remote URL: ${url}...`);

		const pluginName = basename(url).split("?")[0] || "plugin";
		const installPath = join(pluginDir, pluginName);

		// Download using curl or fetch
		try {
			await execa("curl", ["-L", "-o", installPath, url], {
				stdio: "pipe",
			});
		} catch {
			// Try wget as fallback
			await execa("wget", ["-O", installPath, url], {
				stdio: "pipe",
			});
		}

		return {
			id: pluginName.replace(/\.[^.]+$/, ""),
			version: "1.0.0",
			source: "remote",
			location: url,
			installedAt: new Date().toISOString(),
		};
	}

	/**
	 * Install a plugin based on dependency specification.
	 */
	static async install(
		workspaceRoot: string,
		pluginId: string,
		dependency: PluginDependency
	): Promise<InstalledPlugin> {
		const source = dependency.source || this.inferSource(dependency);

		switch (source) {
			case "npm":
				return this.installFromNpm(
					workspaceRoot,
					dependency.url || pluginId,
					dependency.version
				);
			case "git":
				return this.installFromGit(
					workspaceRoot,
					dependency.url || dependency.path || "",
					dependency.version
				);
			case "local":
				return this.installFromLocal(
					workspaceRoot,
					dependency.path || dependency.url || ""
				);
			case "remote":
				return this.installFromRemote(workspaceRoot, dependency.url || "");
			default:
				throw new Error(`Unknown plugin source: ${source}`);
		}
	}

	/**
	 * Infer source type from dependency specification.
	 */
	static inferSource(dependency: PluginDependency): "npm" | "git" | "local" | "remote" {
		if (dependency.source) {
			return dependency.source;
		}

		const url = dependency.url || dependency.path || "";

		if (url.startsWith("git+") || url.startsWith("git://") || url.endsWith(".git")) {
			return "git";
		}

		if (url.startsWith("http://") || url.startsWith("https://")) {
			return "remote";
		}

		if (url && existsSync(url)) {
			return "local";
		}

		// Default to npm
		return "npm";
	}

	/**
	 * List all installed plugins.
	 */
	static async listInstalled(workspaceRoot: string): Promise<InstalledPlugin[]> {
		const lock = await this.loadLock(workspaceRoot);
		return Object.values(lock.plugins);
	}

	/**
	 * Remove a plugin.
	 */
	static async remove(
		workspaceRoot: string,
		pluginId: string
	): Promise<void> {
		const lock = await this.loadLock(workspaceRoot);
		const installed = lock.plugins[pluginId];

		if (!installed) {
			throw new Error(`Plugin ${pluginId} is not installed`);
		}

		// Remove from filesystem
		const pluginDir = this.getPluginDir(workspaceRoot);

		// Try to find the plugin directory
		const entries = await readdir(pluginDir);
		for (const entry of entries) {
			const entryPath = join(pluginDir, entry);
			const statInfoSync = statSync(entryPath);
			if (statInfoSync.isDirectory() && entry.startsWith(pluginId)) {
				await execa("rm", ["-rf", entryPath], { shell: true });
				break;
			}
		}

		// Remove from lock file
		delete lock.plugins[pluginId];
		await this.saveLock(workspaceRoot, lock);

		Logger.success(`Removed plugin ${pluginId}`);
	}

	/**
	 * Get installed plugin path.
	 */
	static async getPluginPath(
		workspaceRoot: string,
		pluginId: string
	): Promise<string | null> {
		const lock = await this.loadLock(workspaceRoot);
		const installed = lock.plugins[pluginId];

		if (!installed) {
			return null;
		}

		const pluginDir = this.getPluginDir(workspaceRoot);
		if (!existsSync(pluginDir)) {
			return null;
		}
		const entries = await readdir(pluginDir);
		for (const entry of entries) {
			const entryPath = join(pluginDir, entry);
			const statInfoSync = statSync(entryPath);
			if (statInfoSync.isDirectory() && entry.startsWith(pluginId)) {
				return entryPath;
			}
		}

		return null;
	}
}

