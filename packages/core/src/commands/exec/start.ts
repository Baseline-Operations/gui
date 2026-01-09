import { existsSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import { ConfigManager } from "../../config/manager.js";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";

export interface StartOptions {
	filter?: string;
	workspaceRoot?: string;
}

export interface StartResult {
	success: boolean;
	started: number;
	skipped: number;
	totalRepos: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
	errorRepos: Array<{ name: string; error: string }>;
}

/**
 * Start applications across repositories.
 * Only runs start commands explicitly configured in baseline.json or baseline.project.json.
 * Does not auto-detect from package.json (for safety).
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function startApplications(
	options: StartOptions = {}
): Promise<StartResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	const skippedRepos: Array<{ name: string; reason: string }> = [];
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
			started: 0,
			skipped: 0,
			totalRepos: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			skippedRepos: [],
			errorRepos: [],
		};
	}

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	let repos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	// Apply filters
	if (options.filter) {
		repos = filterRepos(repos, options.filter);
	}

	if (repos.length === 0) {
		return {
			success: true,
			started: 0,
			skipped: 0,
			totalRepos: 0,
			messages: [{ type: "warn", message: "No repositories match the filter." }],
			skippedRepos: [],
			errorRepos: [],
		};
	}

	messages.push({ type: "info", message: "Starting Applications" });

	let started = 0;
	let skipped = 0;

	for (const repo of repos) {
		const repoPath = join(workspaceRoot, repo.path);

		if (!existsSync(repoPath)) {
			const reason = "not cloned";
			messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
			skippedRepos.push({ name: repo.name, reason });
			skipped++;
			continue;
		}

		const startCommand = await getRepoStartCommand(
			repo,
			workspaceRoot
		);
		if (!startCommand) {
			const reason = "no start command configured";
			messages.push({ type: "dim", message: `Skipping ${repo.name} (${reason})` });
			messages.push({ type: "dim", message: `  Configure start command in baseline.json or baseline.project.json` });
			skippedRepos.push({ name: repo.name, reason });
			skipped++;
			continue;
		}

		try {
			messages.push({ type: "info", message: `Starting ${repo.name}...` });

			const commandRunner = await LanguageDiscovery.getCommandRunner(
				repo,
				workspaceRoot,
				configManager,
				pluginManager
			);

			if (repo.startInDocker) {
				await startInDocker(
					repo,
					workspaceRoot,
					startCommand,
					commandRunner.runner || "npm",
					messages
				);
			} else {
				const [cmd, ...args] = startCommand.split(/\s+/);

				if (commandRunner.runner) {
					// Run in background (don't wait for it)
					execa(
						commandRunner.runner,
						[...commandRunner.args, cmd, ...args],
						{
							cwd: repoPath,
							stdio: "inherit",
							detached: true,
						}
					);
				} else {
					// Run command directly (for non-Node.js languages)
					execa(cmd, args, {
						cwd: repoPath,
						stdio: "inherit",
						detached: true,
					});
				}
			}

			messages.push({ type: "success", message: `Started ${repo.name}` });
			started++;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed to start ${repo.name}: ${errorMsg}` });
			errorRepos.push({ name: repo.name, error: errorMsg });
		}
	}

	messages.push({ type: "info", message: "Start Summary" });
	messages.push({ type: "info", message: `Started: ${started}` });
	if (skipped > 0) {
		messages.push({ type: "info", message: `Skipped: ${skipped}` });
	}

	if (started > 0) {
		messages.push({ type: "info", message: "\nApplications running in background. Press Ctrl+C to stop." });
	}

	return {
		success: errorRepos.length === 0,
		started,
		skipped,
		totalRepos: repos.length,
		messages,
		skippedRepos,
		errorRepos,
	};
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
			if (f === "library") {
				return repo.library === true;
			}
			// Default to name match
			return repo.name === f;
		});
	});
}

async function getRepoStartCommand(
	repo: import("../../types/config.js").NormalizedRepo,
	workspaceRoot: string
): Promise<string | null> {
	// Use language discovery utility (start commands are not auto-discovered for safety)
	// Only returns start command if explicitly configured in baseline.json or baseline.project.json
	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	// LanguageDiscovery.discoverCommand will only return start if explicitly configured
	return await LanguageDiscovery.discoverCommand(
		repo,
		workspaceRoot,
		"start",
		pluginManager
	);
}

async function startInDocker(
	repo: import("../../types/config.js").NormalizedRepo,
	workspaceRoot: string,
	startCommand: string,
	repoPM: string,
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>
): Promise<void> {
	const repoPath = join(workspaceRoot, repo.path);
	const dockerImage = repo.dockerImage || "node:20";
	const containerName = `baseline-${repo.name}`;

	messages.push({ type: "dim", message: `  Starting in Docker container: ${containerName}` });

	// Build Docker command
	// This is a simplified implementation - you may want to customize this
	const dockerCmd = [
		"docker",
		"run",
		"-d",
		"--name",
		containerName,
		"-v",
		`${repoPath}:/app`,
		"-w",
		"/app",
		dockerImage,
		"sh",
		"-c",
		startCommand,
	];

	try {
		await execa(dockerCmd[0], dockerCmd.slice(1), {
			cwd: repoPath,
			stdio: "inherit",
		});
		messages.push({ type: "success", message: `  Container ${containerName} started` });
	} catch (error) {
		throw new Error(
			`Failed to start Docker container: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}
