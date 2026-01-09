import { join } from "path";
import { ConfigManager } from "../../config/manager.js";
import { GitUtil } from "../../utils/git.js";

export interface StatusOptions {
	workspaceRoot?: string;
}

export interface RepoStatus {
	name: string;
	branch: string;
	isDirty: boolean;
	ahead: number;
	behind: number;
	notCloned?: boolean;
	error?: string;
}

export interface StatusResult {
	success: boolean;
	repos: RepoStatus[];
	messages: Array<{ type: "info" | "error" | "warn"; message: string }>;
}

/**
 * Get status of all repositories.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function getRepositoryStatus(
	options: StatusOptions = {}
): Promise<StatusResult> {
	const messages: Array<{ type: "info" | "error" | "warn"; message: string }> = [];
	const repos: RepoStatus[] = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			repos: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	if ((config.packages || config.repos || []).length === 0) {
		return {
			success: true,
			repos: [],
			messages: [{ type: "warn", message: "No repositories configured." }],
		};
	}

	messages.push({ type: "info", message: "Repository Status" });

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	for (const repo of normalizedRepos) {
		try {
			const repoPath = join(workspaceRoot, repo.path);
			if (!(await GitUtil.isRepo(repoPath))) {
				repos.push({
					name: repo.name,
					branch: "",
					isDirty: false,
					ahead: 0,
					behind: 0,
					notCloned: true,
				});
				continue;
			}

			const status = await GitUtil.getStatus(repoPath);
			repos.push({
				name: repo.name,
				branch: status.branch,
				isDirty: status.isDirty,
				ahead: status.ahead,
				behind: status.behind,
			});
		} catch (error) {
			repos.push({
				name: repo.name,
				branch: "",
				isDirty: false,
				ahead: 0,
				behind: 0,
				error: error instanceof Error ? error.message : String(error),
			});
			messages.push({
				type: "error",
				message: `${repo.name}: ${error instanceof Error ? error.message : String(error)}`,
			});
		}
	}

	return {
		success: true,
		repos,
		messages,
	};
}
