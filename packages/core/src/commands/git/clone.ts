import { mkdir } from "fs/promises";
import { dirname, join } from "path";
import { ConfigManager } from "../../config/manager.js";
import { GitUtil } from "../../utils/git.js";
import { getRepoGitUrl } from "../../utils/repo-url.js";
import { normalizeRepo } from "../../utils/config-helpers.js";

export interface CloneOptions {
	workspaceRoot?: string;
}

export interface CloneResult {
	success: boolean;
	cloned: number;
	skipped: number;
	errors: number;
	totalRepos: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
	errorRepos: Array<{ name: string; error: string }>;
}

/**
 * Clone all repositories that haven't been cloned yet.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function cloneRepositories(
	options: CloneOptions = {}
): Promise<CloneResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	const errorRepos: Array<{ name: string; error: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			cloned: 0,
			skipped: 0,
			errors: 0,
			totalRepos: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			errorRepos: [],
		};
	}

	if ((config.packages || config.repos || []).length === 0) {
		return {
			success: true,
			cloned: 0,
			skipped: 0,
			errors: 0,
			totalRepos: 0,
			messages: [{ type: "warn", message: "No repositories configured. Run `baseline add <gitUrl>` to add repositories." }],
			errorRepos: [],
		};
	}

	messages.push({ type: "info", message: "Cloning Repositories" });

	let cloned = 0;
	let skipped = 0;
	let errors = 0;
	const totalRepos = (config.packages || config.repos || []).length;

	const packages = config.packages || config.repos || [];
	for (let i = 0; i < packages.length; i++) {
		const repoRaw = packages[i];
		const repo = normalizeRepo(repoRaw, workspaceRoot);
		try {
			const repoPath = join(workspaceRoot, repo.path);
			if (await GitUtil.isRepo(repoPath)) {
				messages.push({ type: "info", message: `Skipping ${repo.name} (already cloned)` });
				skipped++;
				continue;
			}

			// Get git URL (handles gitUrl, repository, or local)
			const gitUrl = await getRepoGitUrl(repo);
			if (!gitUrl) {
				messages.push({ type: "info", message: `Skipping ${repo.name} (local repository, no git URL)` });
				skipped++;
				continue;
			}

			messages.push({ type: "info", message: `Cloning ${repo.name}...` });
			await mkdir(dirname(repoPath), { recursive: true });
			await GitUtil.clone(gitUrl, repoPath);
			messages.push({ type: "success", message: `Cloned ${repo.name}` });
			cloned++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed to clone ${repo.name}: ${errorMsg}` });
			errorRepos.push({ name: repo.name, error: errorMsg });
			errors++;
		}
	}

	messages.push({ type: "info", message: "Clone Summary" });
	messages.push({ type: "info", message: `Cloned: ${cloned}` });
	messages.push({ type: "info", message: `Skipped: ${skipped}` });
	if (errors > 0) {
		messages.push({ type: "warn", message: `Errors: ${errors}` });
	}

	return {
		success: errors === 0,
		cloned,
		skipped,
		errors,
		totalRepos,
		messages,
		errorRepos,
	};
}
