import { join } from "path";
import { ConfigManager } from "../../config/manager.js";
import { GitUtil } from "../../utils/git.js";

export interface SyncOptions {
	workspaceRoot?: string;
}

export interface SyncResult {
	success: boolean;
	synced: number;
	skipped: number;
	errors: number;
	totalRepos: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
	errorRepos: Array<{ name: string; error: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
}

/**
 * Sync all repositories (fetch and pull).
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function syncRepositories(
	options: SyncOptions = {}
): Promise<SyncResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	const errorRepos: Array<{ name: string; error: string }> = [];
	const skippedRepos: Array<{ name: string; reason: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			synced: 0,
			skipped: 0,
			errors: 0,
			totalRepos: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	if ((config.packages || config.repos || []).length === 0) {
		return {
			success: true,
			synced: 0,
			skipped: 0,
			errors: 0,
			totalRepos: 0,
			messages: [{ type: "warn", message: "No repositories configured." }],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	messages.push({ type: "info", message: "Syncing Repositories" });

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	let synced = 0;
	let skipped = 0;
	let errors = 0;
	const totalRepos = normalizedRepos.length;

	for (const repo of normalizedRepos) {
		try {
			const repoPath = join(workspaceRoot, repo.path);
			if (!(await GitUtil.isRepo(repoPath))) {
				const reason = "not cloned";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			const status = await GitUtil.getStatus(repoPath);

			if (status.hasUncommittedChanges) {
				const reason = "has uncommitted changes";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			messages.push({ type: "info", message: `Syncing ${repo.name}...` });
			await GitUtil.fetch(repoPath);
			await GitUtil.pull(repoPath, repo.defaultBranch);
			messages.push({ type: "success", message: `Synced ${repo.name}` });
			synced++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed to sync ${repo.name}: ${errorMsg}` });
			errorRepos.push({ name: repo.name, error: errorMsg });
			errors++;
		}
	}

	messages.push({ type: "info", message: "Sync Summary" });
	messages.push({ type: "info", message: `Synced: ${synced}` });
	if (errors > 0) {
		messages.push({ type: "warn", message: `Errors: ${errors}` });
	}

	return {
		success: errors === 0,
		synced,
		skipped,
		errors,
		totalRepos,
		messages,
		errorRepos,
		skippedRepos,
	};
}
