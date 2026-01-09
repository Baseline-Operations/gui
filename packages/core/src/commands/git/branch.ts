import { join } from "path";
import { execa } from "execa";
import { ConfigManager } from "../../config/manager.js";
import { GitUtil } from "../../utils/git.js";

export interface BranchOptions {
	create?: boolean;
	force?: boolean;
	workspaceRoot?: string;
}

export interface BranchResult {
	success: boolean;
	created: number;
	checkedOut: number;
	skipped: number;
	errors: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
	errorRepos: Array<{ name: string; error: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
}

/**
 * Create or checkout branches across repositories.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function branchRepositories(
	branchName: string,
	options: BranchOptions = {}
): Promise<BranchResult> {
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
			created: 0,
			checkedOut: 0,
			skipped: 0,
			errors: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	if ((config.packages || config.repos || []).length === 0) {
		return {
			success: true,
			created: 0,
			checkedOut: 0,
			skipped: 0,
			errors: 0,
			messages: [{ type: "warn", message: "No repositories configured." }],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	messages.push({
		type: "info",
		message: `${options.create ? "Creating" : "Checking out"} branch: ${branchName}`,
	});

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	let created = 0;
	let checkedOut = 0;
	let skipped = 0;
	let errors = 0;

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

			if (status.hasUncommittedChanges && !options.force) {
				const reason = "has uncommitted changes. Use --force to override";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			// Check if branch exists locally
			let branchExists = false;
			try {
				const { stdout } = await execa(
					"git",
					["branch", "--list", branchName],
					{ cwd: repoPath }
				);
				branchExists = stdout.trim().length > 0;
			} catch {
				// Check remote branches
				try {
					const remote = await GitUtil.getRemoteName(repoPath);
					await execa("git", ["fetch", remote], {
						cwd: repoPath,
						stdio: "ignore",
					});
					const { stdout } = await execa(
						"git",
						["branch", "-r", "--list", `${remote}/${branchName}`],
						{ cwd: repoPath }
					);
					branchExists = stdout.trim().length > 0;
					if (branchExists) {
						// Branch exists on remote, checkout with tracking
						await execa(
							"git",
							["checkout", "-b", branchName, `${remote}/${branchName}`],
							{ cwd: repoPath, stdio: "ignore" }
						);
						checkedOut++;
						messages.push({
							type: "success",
							message: `Checked out remote branch in ${repo.name}`,
						});
						continue;
					}
				} catch {
					// Branch doesn't exist
				}
			}

			if (branchExists) {
				// Branch exists locally, checkout it
				await GitUtil.checkoutBranch(repoPath, branchName, false);
				checkedOut++;
				messages.push({
					type: "success",
					message: `Checked out existing branch in ${repo.name}`,
				});
			} else if (options.create) {
				// Branch doesn't exist, create it if requested
				await GitUtil.checkoutBranch(repoPath, branchName, true);
				created++;
				messages.push({
					type: "success",
					message: `Created and checked out branch in ${repo.name}`,
				});
			} else {
				const errorMsg = `Branch ${branchName} does not exist. Use --create to create it.`;
				messages.push({
					type: "error",
					message: `${repo.name}: ${errorMsg}`,
				});
				errorRepos.push({ name: repo.name, error: errorMsg });
				errors++;
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({
				type: "error",
				message: `Failed in ${repo.name}: ${errorMsg}`,
			});
			errorRepos.push({ name: repo.name, error: errorMsg });
			errors++;
		}
	}

	messages.push({ type: "info", message: "Branch Summary" });
	messages.push({ type: "info", message: `Created: ${created}` });
	messages.push({ type: "info", message: `Checked out: ${checkedOut}` });
	messages.push({ type: "info", message: `Skipped: ${skipped}` });
	if (errors > 0) {
		messages.push({ type: "warn", message: `Errors: ${errors}` });
	}

	return {
		success: errors === 0,
		created,
		checkedOut,
		skipped,
		errors,
		messages,
		errorRepos,
		skippedRepos,
	};
}
