import { execa } from "execa";
import { join } from "path";
import { existsSync } from "fs";
import { ConfigManager } from "../../config/manager.js";
import { GitUtil } from "../../utils/git.js";
import { PluginManager } from "../../plugins/manager.js";
import { ProviderPlugin } from "../../plugins/types.js";

export interface PrCreateOptions {
	title?: string;
	body?: string;
	base?: string;
	draft?: boolean;
	repo?: string;
	workspaceRoot?: string;
}

export interface PrResult {
	success: boolean;
	created: number;
	skipped: number;
	errors: number;
	prUrls: Array<{ repo: string; url: string }>;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
	errorRepos: Array<{ name: string; error: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
}

/**
 * Create pull requests for repositories.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function createPullRequests(
	options: PrCreateOptions = {}
): Promise<PrResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	const errorRepos: Array<{ name: string; error: string }> = [];
	const skippedRepos: Array<{ name: string; reason: string }> = [];
	const prUrls: Array<{ repo: string; url: string }> = [];
	
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
			skipped: 0,
			errors: 0,
			prUrls: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	messages.push({ type: "info", message: "Creating Pull Requests" });

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const allReposNormalized = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	const reposToProcess =
		options.repo ?
			allReposNormalized.filter((r) => r.name === options.repo)
		:	allReposNormalized;

	// Auto-detect provider plugin from repository URLs
	const providerPlugins = pluginManager.getPluginsByType(
		"provider"
	) as ProviderPlugin[];
	let providerPlugin: ProviderPlugin | undefined;

	// If specific repo is requested, use its provider
	if (options.repo && reposToProcess.length > 0) {
		const repo = reposToProcess[0];
		// Check if repo has provider info
		if (repo.repository) {
			const plugin = pluginManager.getPlugin(repo.repository.provider);
			if (plugin && plugin.metadata.type === "provider") {
				providerPlugin = plugin as ProviderPlugin;
			}
		} else if (repo.gitUrl) {
			// Find matching provider plugin from gitUrl
			for (const plugin of providerPlugins) {
				if (plugin.matchesUrl && plugin.matchesUrl(repo.gitUrl)) {
					providerPlugin = plugin;
					break;
				}
			}
		}
	} else if (config.github?.provider === "github") {
		// Fallback to GitHub if configured
		const plugin = pluginManager.getPlugin("github");
		if (plugin && plugin.metadata.type === "provider") {
			providerPlugin = plugin as ProviderPlugin;
		}
	}

	// If still no provider, try to detect from first repo
	if (!providerPlugin && reposToProcess.length > 0) {
		const firstRepo = reposToProcess[0];
		if (firstRepo.repository) {
			const plugin = pluginManager.getPlugin(firstRepo.repository.provider);
			if (plugin && plugin.metadata.type === "provider") {
				providerPlugin = plugin as ProviderPlugin;
			}
		} else if (firstRepo.gitUrl) {
			for (const plugin of providerPlugins) {
				if (plugin.matchesUrl && plugin.matchesUrl(firstRepo.gitUrl)) {
					providerPlugin = plugin;
					break;
				}
			}
		}
	}

	if (!providerPlugin || !providerPlugin.createPullRequest) {
		return {
			success: false,
			created: 0,
			skipped: 0,
			errors: 0,
			prUrls: [],
			messages: [
				{ type: "error", message: "No provider plugin found for PR creation." },
				{
					type: "info",
					message: "Could not detect provider from repository URLs. Ensure repositories use GitHub, GitLab, or Bitbucket URLs, or configure a provider plugin.",
				},
			],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	messages.push({ type: "info", message: `Using ${providerPlugin.metadata.name} provider` });

	if (reposToProcess.length === 0) {
		return {
			success: false,
			created: 0,
			skipped: 0,
			errors: 0,
			prUrls: [],
			messages: [
				{
					type: "error",
					message: options.repo ?
						`Repository "${options.repo}" not found.`
					:	"No repositories configured.",
				},
			],
			errorRepos: [],
			skippedRepos: [],
		};
	}

	let created = 0;
	let errors = 0;
	let skipped = 0;

	for (const repo of reposToProcess) {
		try {
			const repoPath = join(workspaceRoot, repo.path);

			if (!existsSync(repoPath)) {
				const reason = "not cloned";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			if (!(await GitUtil.isRepo(repoPath))) {
				const reason = "not a git repository";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			const status = await GitUtil.getStatus(repoPath);
			const currentBranch = status.branch;

			if (status.isDirty) {
				const reason = "has uncommitted changes";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				skipped++;
				continue;
			}

			// Check if branch has commits
			let shouldSkip = false;
			try {
				const remote = await GitUtil.getRemoteName(repoPath);
				const { stdout } = await execa(
					"git",
					["rev-list", "--count", `${remote}/${currentBranch}`],
					{ cwd: repoPath }
				);
				if (Number(stdout.trim()) === 0) {
					const reason = `branch ${currentBranch} has no commits`;
					messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
					skippedRepos.push({ name: repo.name, reason });
					skipped++;
					shouldSkip = true;
				}
			} catch {
				// Branch might not exist on remote, try to push
				try {
					const remote = await GitUtil.getRemoteName(repoPath);
					await execa("git", ["push", "-u", remote, currentBranch], {
						cwd: repoPath,
						stdio: "ignore",
					});
				} catch {
					const reason = `could not push branch ${currentBranch}`;
					messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
					skippedRepos.push({ name: repo.name, reason });
					skipped++;
					shouldSkip = true;
				}
			}

			if (shouldSkip) {
				continue;
			}

			messages.push({ type: "info", message: `Creating PR for ${repo.name}...` });

			const baseBranch = options.base || repo.defaultBranch;
			const prTitle =
				options.title ||
				`Update ${repo.name} (from baseline)` ||
				`PR for ${repo.name}`;
			const prBody =
				options.body || `Updates from baseline workspace.`;

			try {
				const prUrl = await providerPlugin.createPullRequest!({
					repoPath,
					title: prTitle,
					body: prBody,
					base: baseBranch,
					head: currentBranch,
					draft: options.draft,
				});

				messages.push({ type: "success", message: `Created PR for ${repo.name}` });
				messages.push({ type: "info", message: `  ${prUrl}` });
				prUrls.push({ repo: repo.name, url: prUrl });
				created++;
			} catch (error) {
				// Check if PR already exists
				if (
					error instanceof Error &&
					error.message.includes("already exists")
				) {
					const reason = `PR already exists on branch ${currentBranch}`;
					messages.push({ type: "warn", message: `${repo.name}: ${reason}` });
					skippedRepos.push({ name: repo.name, reason });
					skipped++;
				} else {
					const errorMsg = error instanceof Error ? error.message : String(error);
					messages.push({
						type: "error",
						message: `Failed to create PR for ${repo.name}: ${errorMsg}`,
					});
					errorRepos.push({ name: repo.name, error: errorMsg });
					errors++;
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({
				type: "error",
				message: `Error processing ${repo.name}: ${errorMsg}`,
			});
			errorRepos.push({ name: repo.name, error: errorMsg });
			errors++;
		}
	}

	messages.push({ type: "info", message: "PR Creation Summary" });
	messages.push({ type: "info", message: `Created: ${created}` });
	if (errors > 0) {
		messages.push({ type: "warn", message: `Errors: ${errors}` });
	}

	return {
		success: errors === 0,
		created,
		skipped,
		errors,
		prUrls,
		messages,
		errorRepos,
		skippedRepos,
	};
}
