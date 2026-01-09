import { join } from "path";
import { ConfigManager } from "../../config/manager.js";
import { Package, NormalizedPackage } from "../../types/config.js";

export interface AddOptions {
	name?: string;
	path?: string;
	tags?: string[];
	languages?: string[];
	packageManager?: "npm" | "pnpm" | "yarn";
	library?: boolean;
	commands?: {
		test?: string;
		lint?: string;
		start?: string;
	};
	startInDocker?: boolean;
	dockerImage?: string;
	requiredPlugins?: string[];
}

export interface AddRepositoryOptions extends AddOptions {
	workspaceRoot?: string;
}

export interface AddRepositoryResult {
	success: boolean;
	repo: NormalizedPackage;
	errors?: string[];
}

/**
 * Add a repository to the workspace configuration.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function addRepository(
	gitUrl: string,
	options: AddRepositoryOptions = {}
): Promise<AddRepositoryResult> {
	const configManager = new ConfigManager();
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			repo: {} as NormalizedPackage,
			errors: ["No baseline workspace found. Run `baseline init` first."],
		};
	}

	const workspaceRoot = options.workspaceRoot || configManager.getWorkspaceRoot();

	// Extract repo name from URL if not provided
	const repoName = options.name || extractRepoName(gitUrl);
	const repoPath = options.path || join(workspaceRoot, repoName);

	const commands = options.commands;
	const hasCommands =
		commands && (commands.test || commands.lint || commands.start);

	const newRepo: NormalizedPackage = {
		id: repoName,
		name: repoName,
		location: gitUrl,
		gitUrl, // Legacy alias
		defaultBranch: "main",
		path: repoPath,
		tags: options.tags || [],
		languages: options.languages || [],
		packageManager: options.packageManager,
		library: options.library ?? false,
		commands: hasCommands ? commands : undefined,
		startInDocker: options.startInDocker ?? false,
		dockerImage: options.dockerImage,
		requiredPlugins: options.requiredPlugins,
	};

	// Check for duplicates (normalize repos first)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);
	
	if (
		normalizedRepos.some(
			(r) => r.name === repoName || r.path === repoPath
		)
	) {
		return {
			success: false,
			repo: newRepo,
			errors: [
				`Repository with name "${repoName}" or path "${repoPath}" already exists.`,
			],
		};
	}

	const packages = config.packages || config.repos || [];
	packages.push(newRepo);
	config.packages = packages;
	await configManager.save(config);

	return {
		success: true,
		repo: newRepo,
	};
}

function extractRepoName(gitUrl: string): string {
	// Extract repo name from various URL formats
	const patterns = [/([^/]+)\.git$/, /([^/]+)\/?$/];

	for (const pattern of patterns) {
		const match = gitUrl.match(pattern);
		if (match) {
			return match[1].replace(/\.git$/, "");
		}
	}

	return "unknown-repo";
}
