import { execa } from "execa";
import { join } from "path";
import { ConfigManager } from "../../config/manager.js";

export interface ExecOptions {
	filter?: string;
	parallel?: boolean;
	failFast?: boolean;
	workspaceRoot?: string;
}

export interface ExecResult {
	success: boolean;
	command: string;
	completed: number;
	failed: number;
	totalRepos: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
	failedRepos: Array<{ name: string; error: string }>;
}

/**
 * Execute a command in repositories.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function executeCommand(
	command: string,
	options: ExecOptions = {}
): Promise<ExecResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	const failedRepos: Array<{ name: string; error: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			command,
			completed: 0,
			failed: 0,
			totalRepos: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			failedRepos: [],
		};
	}

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	let repos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Apply filters
	if (options.filter) {
		repos = filterRepos(repos, options.filter);
	}

	if (repos.length === 0) {
		return {
			success: true,
			command,
			completed: 0,
			failed: 0,
			totalRepos: 0,
			messages: [{ type: "warn", message: "No repositories match the filter." }],
			failedRepos: [],
		};
	}

	messages.push({ type: "info", message: `Executing: ${command}` });

	if (options.parallel) {
		const result = await execParallel(repos, command, workspaceRoot, options.failFast, messages, failedRepos);
		return {
			success: result.success,
			command,
			completed: result.completed,
			failed: result.failed,
			totalRepos: repos.length,
			messages,
			failedRepos,
		};
	} else {
		const result = await execSequential(repos, command, workspaceRoot, options.failFast, messages, failedRepos);
		return {
			success: result.success,
			command,
			completed: result.completed,
			failed: result.failed,
			totalRepos: repos.length,
			messages,
			failedRepos,
		};
	}
}

function filterRepos(repos: import("../../types/config.js").NormalizedRepo[], filter: string): import("../../types/config.js").NormalizedRepo[] {
	const filters = filter.split(",").map((f) => f.trim());

	return repos.filter((repo) => {
		return filters.some((f) => {
			if (f.startsWith("tag=")) {
				const tag = f.substring(4);
				return repo.tags?.includes(tag) || false;
			}
			if (f.startsWith("name=")) {
				const name = f.substring(5);
				return repo.name === name;
			}
			// Default to name match
			return repo.name === f;
		});
	});
}

async function execSequential(
	repos: import("../../types/config.js").NormalizedRepo[],
	command: string,
	workspaceRoot: string,
	failFast: boolean | undefined,
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>,
	failedRepos: Array<{ name: string; error: string }>
): Promise<{ success: boolean; completed: number; failed: number }> {
	let completed = 0;
	let failed = 0;
	
	for (const repo of repos) {
		try {
			const repoPath = join(workspaceRoot, repo.path);
			messages.push({ type: "info", message: `Running in ${repo.name}...` });
			const [cmd, ...args] = command.split(/\s+/);
			await execa(cmd, args, {
				cwd: repoPath,
				stdio: "inherit",
			});
			messages.push({ type: "success", message: `Completed ${repo.name}` });
			completed++;
		} catch (error) {
			failed++;
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed in ${repo.name}: ${errorMsg}` });
			failedRepos.push({ name: repo.name, error: errorMsg });
			if (failFast) {
				break;
			}
		}
	}
	
	return { success: failed === 0, completed, failed };
}

async function execParallel(
	repos: import("../../types/config.js").NormalizedRepo[],
	command: string,
	workspaceRoot: string,
	failFast: boolean | undefined,
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>,
	failedRepos: Array<{ name: string; error: string }>
): Promise<{ success: boolean; completed: number; failed: number }> {
	const [cmd, ...args] = command.split(/\s+/);
	const promises = repos.map(async (repo: import("../../types/config.js").NormalizedRepo) => {
		try {
			const repoPath = join(workspaceRoot, repo.path);
			messages.push({ type: "info", message: `Running in ${repo.name}...` });
			await execa(cmd, args, {
				cwd: repoPath,
				stdio: "inherit",
			});
			messages.push({ type: "success", message: `Completed ${repo.name}` });
			return { success: true, repo: repo.name };
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed in ${repo.name}: ${errorMsg}` });
			failedRepos.push({ name: repo.name, error: errorMsg });
			return { success: false, repo: repo.name, error: errorMsg };
		}
	});

	const results = await Promise.all(promises);
	const failures = results.filter((r) => !r.success);
	const completed = results.filter((r) => r.success).length;
	const failed = failures.length;

	if (failed > 0) {
		messages.push({ type: "warn", message: `${failed} repository(ies) failed` });
	}

	return { success: failed === 0, completed, failed };
}

