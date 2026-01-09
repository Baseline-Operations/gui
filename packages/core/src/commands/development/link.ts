import { writeFileSync } from "fs";
import { join } from "path";
import { ConfigManager } from "../../config/manager.js";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";
import { PackageManagerPlugin } from "../../plugins/types.js";

export interface LinkOptions {
	workspaceRoot?: string;
}

export interface LinkResult {
	success: boolean;
	linkedConfigs: Array<{ file: string; pm: string; packages: number }>;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
}

/**
 * Link workspace repositories using package manager plugins.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function linkRepositories(
	options: LinkOptions = {}
): Promise<LinkResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	const linkedConfigs: Array<{ file: string; pm: string; packages: number }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			linkedConfigs: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	messages.push({ type: "info", message: "Linking Workspace" });

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Detect repos by language and find appropriate package manager plugins
	const reposByLanguage = new Map<string, import("../../types/config.js").NormalizedRepo[]>();

	for (const repo of normalizedRepos) {
		const detectedLanguages = repo.languages && repo.languages.length > 0 ?
			repo.languages
		:	await LanguageDiscovery.detectLanguages(
				join(workspaceRoot, repo.path),
				pluginManager
			);

		for (const langId of detectedLanguages) {
			if (!reposByLanguage.has(langId)) {
				reposByLanguage.set(langId, []);
			}
			reposByLanguage.get(langId)!.push(repo);
		}
	}

	if (reposByLanguage.size === 0) {
		return {
			success: true,
			linkedConfigs: [],
			messages: [{ type: "warn", message: "No repositories found with supported languages for workspace linking." }],
		};
	}

	// Find package manager plugins for each language
	const pmPlugins = pluginManager.getPluginsByType("package-manager") as PackageManagerPlugin[];

	for (const [langId, repos] of reposByLanguage.entries()) {
		// Find package manager plugins that support this language
		const compatiblePMs = pmPlugins.filter((pm) => {
			if (pm.metadata.requiresLanguages) {
				return pm.metadata.requiresLanguages.includes(langId);
			}
			// For Node.js, check if it's a Node.js package manager
			if (langId === "node") {
				return ["npm", "pnpm", "yarn"].includes(pm.metadata.id);
			}
			return false;
		});

		// If no specific PM for this language, try to find one that works
		if (compatiblePMs.length === 0 && langId === "node") {
			// Fallback to default Node.js PM
			const defaultPMId = config.packageManager || "npm";
			const defaultPM = pmPlugins.find((pm) => pm.metadata.id === defaultPMId);
			if (defaultPM) {
				compatiblePMs.push(defaultPM);
			}
		}

		for (const pmPlugin of compatiblePMs) {
			if (!pmPlugin.createWorkspaceConfig) {
				continue;
			}

			messages.push({ type: "info", message: `Linking ${langId} repositories using ${pmPlugin.metadata.name}...` });

			const reposForConfig = repos.map((r) => ({
				name: r.name,
				path: r.path,
			}));

			try {
				const workspaceConfig = await pmPlugin.createWorkspaceConfig(
					reposForConfig,
					workspaceRoot
				);

				if (workspaceConfig) {
					const configPath = join(workspaceRoot, workspaceConfig.file);
					writeFileSync(configPath, workspaceConfig.content);
					messages.push({ type: "success", message: `Created ${workspaceConfig.file}` });
					messages.push({ type: "info", message: `  Added ${reposForConfig.length} package(s)` });
					linkedConfigs.push({ file: workspaceConfig.file, pm: pmPlugin.metadata.name, packages: reposForConfig.length });
				}
			} catch (error) {
				messages.push({
					type: "warn",
					message: `Failed to create workspace config for ${pmPlugin.metadata.name}: ${error instanceof Error ? error.message : String(error)}`,
				});
			}
		}
	}

	if (linkedConfigs.length === 0) {
		messages.push({ type: "warn", message: "No workspace configurations created." });
		messages.push({ type: "info", message: "Supported package managers: npm, pnpm, yarn (Node.js), Cargo (Rust), Maven/Gradle (Java)" });
		return {
			success: true,
			linkedConfigs: [],
			messages,
		};
	}

	messages.push({ type: "success", message: "Workspace linking complete!" });
	for (const { file, pm } of linkedConfigs) {
		messages.push({ type: "info", message: `  ${file} (${pm})` });
	}

	return {
		success: true,
		linkedConfigs,
		messages,
	};
}
