import { existsSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import { ConfigManager } from "../../config/manager.js";
import { VersionCheck } from "../../utils/version-check.js";
import {
	PackageManagerUtil,
	PackageManager,
} from "../../utils/package-manager.js";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";

export interface DoctorOptions {
	workspaceRoot?: string;
}

export interface DoctorResult {
	success: boolean;
	errors: number;
	warnings: number;
	issues: Array<{
		severity: "error" | "warning" | "info";
		message: string;
		category?: string;
	}>;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string; category?: string }>;
}

/**
 * Run health checks on the workspace.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function doctorCheck(
	options: DoctorOptions = {}
): Promise<DoctorResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string; category?: string }> = [];
	const issues: Array<{
		severity: "error" | "warning" | "info";
		message: string;
		category?: string;
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
			errors: 1,
			warnings: 0,
			issues: [{ severity: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	messages.push({ type: "info", message: "Baseline Doctor", category: "title" });

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	// Check languages - simplified config is just version policies map
	if (config.languages) {
		for (const [toolName, versionString] of Object.entries(config.languages)) {
			// Get language plugin for this tool (could be a language or a tool within a language)
			let languagePlugin: import("../../plugins/types.js").LanguagePlugin | null = null;

			// Try to find language plugin
			const langPlugin = pluginManager.getPlugin(toolName);
			if (langPlugin && langPlugin.metadata.type === "language") {
				languagePlugin = langPlugin as import("../../plugins/types.js").LanguagePlugin;
			} else {
				// Tool might be within a language (e.g., typescript within node)
				// Try to find parent language plugin
				const nodePlugin = pluginManager.getPlugin("node");
				if (nodePlugin && nodePlugin.metadata.type === "language") {
					languagePlugin = nodePlugin as import("../../plugins/types.js").LanguagePlugin;
				}
			}

			const displayName = languagePlugin?.metadata.name || toolName;
			messages.push({ type: "info", message: `Checking ${displayName} (${toolName})...`, category: "language" });

			try {
				// Get detection command from plugin
				let detection = languagePlugin?.getDetectionCommand?.(toolName);
				if (!detection) {
					// Fallback: try tool name as command
					detection = { command: toolName, args: ["--version"] };
				}

				// Check if tool is installed
				const { stdout } = await execa(
					detection.command,
					detection.args || [],
					{
						timeout: 5000,
					}
				);

				// Extract version from output
				const versionMatch = stdout.match(/(\d+\.\d+\.\d+[^\s]*)/);
				const version =
					versionMatch ? versionMatch[1] : stdout.trim();

				// Parse version policy from string
				const { parseVersionPolicy } = await import("../../utils/config-helpers.js");
				const versionPolicy = parseVersionPolicy(versionString);

				// Check version policy
				const check = VersionCheck.satisfies(version, versionPolicy);
				if (!check.valid) {
					const msg = `${toolName} version ${version} does not satisfy policy ${versionString}: ${check.reason}`;
					issues.push({
						severity: "error",
						message: msg,
						category: "toolchain",
					});
					messages.push({ type: "error", message: `  ${toolName}: ${version} ✗ (required: ${versionString})`, category: "toolchain" });
				} else {
					messages.push({ type: "success", message: `  ${toolName}: ${version} ✓`, category: "toolchain" });
				}
			} catch {
				const msg = `${toolName} is not installed or not accessible`;
				issues.push({
					severity: "error",
					message: msg,
					category: "toolchain",
				});
				messages.push({ type: "error", message: `  ${toolName}: not found`, category: "toolchain" });
			}
		}
	}

	// Check package manager using plugins
			const defaultPMId = config.packageManager || "npm";
	const pmPlugin = pluginManager.getPlugin(defaultPMId);
	if (
		pmPlugin &&
		pmPlugin.metadata.type === "package-manager" &&
		(pmPlugin as import("../../plugins/types.js").PackageManagerPlugin).isInstalled
	) {
		const packageManagerPlugin = pmPlugin as import("../../plugins/types.js").PackageManagerPlugin;
		const pmInstalled = await packageManagerPlugin.isInstalled!();
		if (!pmInstalled) {
			const msg = `Package manager ${defaultPMId} is not installed`;
			issues.push({
				severity: "error",
				message: msg,
				category: "package-manager",
			});
			messages.push({ type: "error", message: `Package manager ${defaultPMId}: not found`, category: "package-manager" });
		} else {
			const pmVersion = await packageManagerPlugin.getVersion?.();
			messages.push({ type: "success", message: `Package manager ${defaultPMId}: ${pmVersion || "installed"}`, category: "package-manager" });
		}
	} else {
		// Fallback to PackageManagerUtil if plugin not found
		const pmInstalled = await PackageManagerUtil.isInstalled(
			defaultPMId as PackageManager
		);
		if (!pmInstalled) {
			const msg = `Package manager ${defaultPMId} is not installed`;
			issues.push({
				severity: "error",
				message: msg,
				category: "package-manager",
			});
			messages.push({ type: "error", message: `Package manager ${defaultPMId}: not found`, category: "package-manager" });
		} else {
			const pmVersion = await PackageManagerUtil.getVersion(
				defaultPMId as PackageManager
			);
			messages.push({ type: "success", message: `Package manager ${defaultPMId}: ${pmVersion}`, category: "package-manager" });
		}
	}

	// Check repositories
	messages.push({ type: "info", message: "Checking Repositories", category: "title" });

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Check repository required plugins (from baseline.json and baseline.project.json)
	messages.push({ type: "info", message: "Checking Repository Required Plugins", category: "title" });
	const { ProjectConfigLoader } = await import("../../utils/project-config.js");
	
	for (const repo of normalizedRepos) {
		const repoPath = join(workspaceRoot, repo.path);
		const missingPlugins: string[] = [];
		
		// Check baseline.project.json for required plugins
		const projectConfig = ProjectConfigLoader.load(repoPath);
		if (projectConfig?.requiredPlugins) {
			for (const pluginId of Object.keys(projectConfig.requiredPlugins)) {
				const plugin = pluginManager.getPlugin(pluginId);
				if (!plugin) {
					missingPlugins.push(pluginId);
				}
			}
		}

		// Check baseline.json repo.requiredPlugins (simple string array)
		if (repo.requiredPlugins && repo.requiredPlugins.length > 0) {
			for (const pluginId of repo.requiredPlugins) {
				const plugin = pluginManager.getPlugin(pluginId);
				if (!plugin) {
					missingPlugins.push(pluginId);
				}
			}
		}

		if (missingPlugins.length > 0) {
			const msg = `Repository ${repo.name} requires missing plugins: ${missingPlugins.join(", ")}`;
			issues.push({
				severity: "error",
				message: msg,
				category: "plugins",
			});
			messages.push({ type: "error", message: `  ${repo.name}: Missing plugins ${missingPlugins.join(", ")}`, category: "plugins" });
		} else if (projectConfig?.requiredPlugins || repo.requiredPlugins) {
			messages.push({ type: "success", message: `  ${repo.name}: All required plugins available`, category: "plugins" });
		}
	}

	for (const repo of normalizedRepos) {
		const repoPath = join(workspaceRoot, repo.path);
		if (!existsSync(repoPath)) {
			const msg = `Repository ${repo.name} is not cloned`;
			issues.push({
				severity: "warning",
				message: msg,
				category: "repos",
			});
			messages.push({ type: "warn", message: `${repo.name}: not cloned`, category: "repos" });
			continue;
		}

		// Use language plugins to check project files
		const projectFiles = await LanguageDiscovery.getProjectFiles(
			repo,
			workspaceRoot,
			pluginManager
		);

		// Check project files (e.g., lockfiles, config files)
		for (const file of projectFiles) {
			if (!file.required) {
				continue; // Only check required files for now
			}

			const filePath = join(repoPath, file.path);
			const exists = existsSync(filePath);

			if (!exists && file.required) {
				const msg = `Repository ${repo.name} is missing ${file.path}${file.description ? ` (${file.description})` : ""}`;
				issues.push({
					severity: "warning",
					message: msg,
					category: "files",
				});
				messages.push({ type: "warn", message: `  ${repo.name}: missing ${file.path}`, category: "files" });
			}
		}

		// Check lockfile consistency for Node.js repos (special case)
		if (repo.languages?.includes("node")) {
			const repoPM =
				repo.packageManager ||
				config.packageManager || "npm";
			const lockFiles: Record<string, string> = {
				npm: "package-lock.json",
				pnpm: "pnpm-lock.yaml",
				yarn: "yarn.lock",
			};

			const expectedLockfile = lockFiles[repoPM] || "package-lock.json";
			const hasLockfile = existsSync(
				join(repoPath, expectedLockfile)
			);

			if (!hasLockfile) {
				const msg = `Repository ${repo.name} is missing ${expectedLockfile}`;
				issues.push({
					severity: "warning",
					message: msg,
					category: "files",
				});
				messages.push({ type: "warn", message: `  ${repo.name}: missing ${expectedLockfile}`, category: "files" });
			} else {
				messages.push({ type: "success", message: `  ${repo.name}: lockfile OK`, category: "files" });
			}
		}
	}

	// Summary
	messages.push({ type: "info", message: "Summary", category: "title" });
	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;

	if (errors > 0) {
		messages.push({ type: "error", message: `Found ${errors} error(s)`, category: "summary" });
		issues
			.filter((i) => i.severity === "error")
			.forEach((i) => {
				messages.push({ type: "error", message: `  - ${i.message}`, category: "summary" });
			});
	}

	if (warnings > 0) {
		messages.push({ type: "warn", message: `Found ${warnings} warning(s)`, category: "summary" });
		issues
			.filter((i) => i.severity === "warning")
			.forEach((i) => {
				messages.push({ type: "warn", message: `  - ${i.message}`, category: "summary" });
			});
	}

	if (errors === 0 && warnings === 0) {
		messages.push({ type: "success", message: "All checks passed!", category: "summary" });
	}

	return {
		success: errors === 0,
		errors,
		warnings,
		issues,
		messages,
	};
}
