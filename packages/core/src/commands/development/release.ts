import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import { ConfigManager } from "../../config/manager.js";
import { GitUtil } from "../../utils/git.js";
import { BaselineConfig } from "../../types/config.js";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";

export interface ReleaseOptions {
	workspaceRoot?: string;
}

export interface PackageInfo {
	name: string;
	path: string;
	currentVersion: string;
	hasChanges: boolean;
}

export interface ReleasePlanResult {
	success: boolean;
	packages: PackageInfo[];
	hasChangesets: boolean;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
	table?: Array<[string, string, string, string]>;
}

export interface ReleaseVersionResult {
	success: boolean;
	usedChangesets: boolean;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
	packages?: Array<{ name: string; version: string; path: string }>;
}

export interface ReleasePublishResult {
	success: boolean;
	usedChangesets: boolean;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
	packages?: Array<{ name: string; version: string; publishable: boolean }>;
}

/**
 * Release management command - routes to appropriate subcommand.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function releaseCommand(
	subcommand: "plan" | "version" | "publish",
	options: ReleaseOptions = {}
): Promise<ReleasePlanResult | ReleaseVersionResult | ReleasePublishResult> {
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		const errorMsg = "No baseline workspace found. Run `baseline init` first.";
		return {
			success: false,
			packages: [],
			hasChangesets: false,
			messages: [{ type: "error", message: errorMsg }],
		};
	}

	switch (subcommand) {
		case "plan":
			return await releasePlan(configManager, config);
		case "version":
			return await releaseVersion(configManager, config);
		case "publish":
			return await releasePublish(configManager, config);
		default:
			return {
				success: false,
				packages: [],
				hasChangesets: false,
				messages: [{ type: "error", message: `Unknown subcommand: ${subcommand}` }],
			};
	}
}

async function releasePlan(
	configManager: ConfigManager,
	config: BaselineConfig
): Promise<ReleasePlanResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	
	const workspaceRoot = configManager.getWorkspaceRoot();
	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	messages.push({ type: "info", message: "Release Plan" });

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Detect Node.js repos using language plugins
	const nodeRepos: import("../../types/config.js").NormalizedRepo[] = [];
	for (const repo of normalizedRepos) {
		if (repo.languages?.includes("node")) {
			nodeRepos.push(repo);
		} else if (!repo.languages || repo.languages.length === 0) {
			// Auto-detect language if not specified
			const detectedLanguages =
				await LanguageDiscovery.detectLanguages(
					join(workspaceRoot, repo.path),
					pluginManager
				);
			if (detectedLanguages.includes("node")) {
				nodeRepos.push(repo);
			}
		}
	}

	if (nodeRepos.length === 0) {
		messages.push({ type: "info", message: "No Node.js repositories found." });
		messages.push({ type: "info", message: "TODO: Release management currently supports Node.js repositories only." });
		messages.push({ type: "info", message: "TODO: Add support for other languages via release plugins." });
		return {
			success: true,
			packages: [],
			hasChangesets: false,
			messages,
		};
	}

	const packages: PackageInfo[] = [];

	for (const repo of nodeRepos) {
		const packageJsonPath = join(
			workspaceRoot,
			repo.path,
			"package.json"
		);
		if (!existsSync(packageJsonPath)) {
			continue;
		}

		try {
			const packageJson = JSON.parse(
				readFileSync(packageJsonPath, "utf-8")
			);
			const repoPath = join(workspaceRoot, repo.path);
			const status =
				(await GitUtil.isRepo(repoPath)) ?
					await GitUtil.getStatus(repoPath)
				:	null;

			packages.push({
				name: packageJson.name || repo.name,
				path: repo.path,
				currentVersion: packageJson.version || "0.0.0",
				hasChanges: status?.isDirty || false,
			});
		} catch (error) {
			messages.push({
				type: "warn",
				message: `Failed to read package.json for ${repo.name}: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}

	if (packages.length === 0) {
		messages.push({ type: "info", message: "No packages found." });
		return {
			success: true,
			packages: [],
			hasChangesets: false,
			messages,
		};
	}

	const table: Array<[string, string, string, string]> = packages.map((pkg) => [
		pkg.name,
		pkg.currentVersion,
		pkg.path,
		pkg.hasChanges ? "Yes" : "No",
	]);

	messages.push({ type: "info", message: `Found ${packages.length} package(s) to release.` });
	
	// Check for Changesets
	const changesetsConfigPath = join(workspaceRoot, ".changeset", "config.json");
	const hasChangesets = existsSync(changesetsConfigPath);
	
	if (hasChangesets) {
		messages.push({ type: "info", message: "Using Changesets for versioning. Run 'baseline release version' to apply changesets and bump versions." });
		messages.push({ type: "info", message: "Run 'baseline release publish' to publish packages using Changesets." });
	} else {
		messages.push({ type: "info", message: "Use 'baseline release version' to bump versions or 'baseline release publish' to publish." });
		messages.push({ type: "info", message: "Tip: Install Changesets for automated versioning: npm install -D @changesets/cli && npx changeset init" });
	}

	return {
		success: true,
		packages,
		hasChangesets,
		messages,
		table,
	};
}

async function releaseVersion(
	configManager: ConfigManager,
	config: BaselineConfig
): Promise<ReleaseVersionResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	const packages: Array<{ name: string; version: string; path: string }> = [];
	
	const workspaceRoot = configManager.getWorkspaceRoot();

	messages.push({ type: "info", message: "Version Bump" });

	// Check for Changesets
	const changesetsConfigPath = join(workspaceRoot, ".changeset", "config.json");
	const hasChangesets = existsSync(changesetsConfigPath);

	if (hasChangesets) {
		messages.push({ type: "info", message: "Detected Changesets configuration. Using Changesets for versioning." });
		
		try {
			// Check if @changesets/cli is available
			await execa("changeset", ["--version"], { timeout: 5000 });
			
			messages.push({ type: "info", message: "Running Changesets version command..." });
			await execa("changeset", ["version"], {
				cwd: workspaceRoot,
				stdio: "inherit",
			});
			
			messages.push({ type: "success", message: "Version bump completed using Changesets." });
			return {
				success: true,
				usedChangesets: true,
				messages,
			};
		} catch (error) {
			messages.push({
				type: "warn",
				message: `Changesets CLI not found or failed: ${error instanceof Error ? error.message : String(error)}`,
			});
			messages.push({ type: "info", message: "Falling back to manual versioning guidance." });
		}
	}

	// Fallback to manual versioning
	messages.push({ type: "warn", message: "Version bumping requires manual configuration. Showing current versions:" });

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Detect Node.js repos using language plugins
	const nodeRepos: import("../../types/config.js").NormalizedRepo[] = [];
	for (const repo of normalizedRepos) {
		if (repo.languages?.includes("node")) {
			nodeRepos.push(repo);
		} else if (!repo.languages || repo.languages.length === 0) {
			// Auto-detect language if not specified
			const detectedLanguages =
				await LanguageDiscovery.detectLanguages(
					join(workspaceRoot, repo.path),
					pluginManager
				);
			if (detectedLanguages.includes("node")) {
				nodeRepos.push(repo);
			}
		}
	}

	if (nodeRepos.length === 0) {
		messages.push({ type: "info", message: "No Node.js repositories found." });
		messages.push({ type: "info", message: "TODO: Release management currently supports Node.js repositories only." });
		messages.push({ type: "info", message: "TODO: Add support for other languages via release plugins." });
		return {
			success: true,
			usedChangesets: false,
			messages,
		};
	}

	for (const repo of nodeRepos) {
		const packageJsonPath = join(
			workspaceRoot,
			repo.path,
			"package.json"
		);
		if (!existsSync(packageJsonPath)) {
			continue;
		}

		try {
			const packageJson = JSON.parse(
				readFileSync(packageJsonPath, "utf-8")
			);
			const currentVersion = packageJson.version || "0.0.0";

			packages.push({
				name: repo.name,
				version: currentVersion,
				path: repo.path,
			});
			
			messages.push({ type: "info", message: `${repo.name}: ${currentVersion}` });
			messages.push({ type: "dim", message: `  To bump version: cd ${repo.path} && npm version patch|minor|major` });
		} catch (error) {
			messages.push({
				type: "warn",
				message: `Failed to read package.json for ${repo.name}: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}

	if (!hasChangesets) {
		messages.push({ type: "info", message: "Tip: Install Changesets for automated version bumping: npm install -D @changesets/cli && npx changeset init" });
	}

	return {
		success: true,
		usedChangesets: false,
		messages,
		packages,
	};
}

async function releasePublish(
	configManager: ConfigManager,
	config: BaselineConfig
): Promise<ReleasePublishResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	const packages: Array<{ name: string; version: string; publishable: boolean }> = [];
	
	const workspaceRoot = configManager.getWorkspaceRoot();

	messages.push({ type: "info", message: "Publish Packages" });

	// Check for Changesets
	const changesetsConfigPath = join(workspaceRoot, ".changeset", "config.json");
	const hasChangesets = existsSync(changesetsConfigPath);

	if (hasChangesets) {
		messages.push({ type: "info", message: "Detected Changesets configuration. Using Changesets for publishing." });
		
		try {
			// Check if @changesets/cli is available
			await execa("changeset", ["--version"], { timeout: 5000 });
			
			messages.push({ type: "info", message: "Running Changesets publish command..." });
			await execa("changeset", ["publish"], {
				cwd: workspaceRoot,
				stdio: "inherit",
			});
			
			messages.push({ type: "success", message: "Publishing completed using Changesets." });
			return {
				success: true,
				usedChangesets: true,
				messages,
			};
		} catch (error) {
			messages.push({
				type: "warn",
				message: `Changesets CLI not found or failed: ${error instanceof Error ? error.message : String(error)}`,
			});
			messages.push({ type: "info", message: "Falling back to manual publishing guidance." });
		}
	}

	// Fallback to manual publishing
	messages.push({ type: "warn", message: "Publishing requires manual configuration. Showing publish-ready packages:" });

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Detect Node.js repos using language plugins
	const nodeRepos: import("../../types/config.js").NormalizedRepo[] = [];
	for (const repo of normalizedRepos) {
		if (repo.languages?.includes("node")) {
			nodeRepos.push(repo);
		} else if (!repo.languages || repo.languages.length === 0) {
			// Auto-detect language if not specified
			const detectedLanguages =
				await LanguageDiscovery.detectLanguages(
					join(workspaceRoot, repo.path),
					pluginManager
				);
			if (detectedLanguages.includes("node")) {
				nodeRepos.push(repo);
			}
		}
	}

	if (nodeRepos.length === 0) {
		messages.push({ type: "info", message: "No Node.js repositories found." });
		messages.push({ type: "info", message: "TODO: Release management currently supports Node.js repositories only." });
		messages.push({ type: "info", message: "TODO: Add support for other languages via release plugins." });
		return {
			success: true,
			usedChangesets: false,
			messages,
		};
	}

	for (const repo of nodeRepos) {
		const repoPath = join(workspaceRoot, repo.path);
		const packageJsonPath = join(repoPath, "package.json");

		if (!existsSync(packageJsonPath)) {
			continue;
		}

		try {
			const packageJson = JSON.parse(
				readFileSync(packageJsonPath, "utf-8")
			);
			const currentVersion = packageJson.version || "0.0.0";
			const isPrivate = packageJson.private !== false;
			const repoPM =
				repo.packageManager || config.packageManager || "npm";

			if (isPrivate) {
				messages.push({ type: "dim", message: `Skipping ${repo.name} (marked as private)` });
				packages.push({
					name: repo.name,
					version: currentVersion,
					publishable: false,
				});
				continue;
			}

			packages.push({
				name: repo.name,
				version: currentVersion,
				publishable: true,
			});
			
			messages.push({ type: "info", message: `${repo.name}@${currentVersion}` });
			messages.push({ type: "dim", message: `  To publish: cd ${repo.path} && ${repoPM} publish --access public` });
		} catch (error) {
			messages.push({
				type: "warn",
				message: `Failed to read package.json for ${repo.name}: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}

	if (!hasChangesets) {
		messages.push({ type: "info", message: "Tip: Install Changesets for automated publishing: npm install -D @changesets/cli && npx changeset init" });
	}

	return {
		success: true,
		usedChangesets: false,
		messages,
		packages,
	};
}
