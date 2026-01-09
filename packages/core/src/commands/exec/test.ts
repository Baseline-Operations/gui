import { existsSync } from "fs";
import { join } from "path";
import { execa } from "execa";
import { ConfigManager } from "../../config/manager.js";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";

export interface TestOptions {
	filter?: string;
	parallel?: boolean;
	failFast?: boolean;
	workspaceRoot?: string;
}

export interface TestResult {
	success: boolean;
	completed: number;
	failed: number;
	skipped: number;
	totalRepos: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
	failedRepos: Array<{ name: string; error: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
}

/**
 * Run test and lint commands for all repositories.
 * Tests run both lint and test commands (lint first, then test).
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function runTests(
	options: TestOptions = {}
): Promise<TestResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	const failedRepos: Array<{ name: string; error: string }> = [];
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
			completed: 0,
			failed: 0,
			skipped: 0,
			totalRepos: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			failedRepos: [],
			skippedRepos: [],
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
			completed: 0,
			failed: 0,
			skipped: 0,
			totalRepos: 0,
			messages: [{ type: "warn", message: "No repositories match the filter." }],
			failedRepos: [],
			skippedRepos: [],
		};
	}

	messages.push({ type: "info", message: "Running Tests" });

	if (options.parallel) {
		return await runTestsParallel(repos, workspaceRoot, configManager, options.failFast, messages, failedRepos, skippedRepos);
	} else {
		return await runTestsSequential(repos, workspaceRoot, configManager, options.failFast, messages, failedRepos, skippedRepos);
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
			if (f === "library") {
				return repo.library === true;
			}
			// Default to name match
			return repo.name === f;
		});
	});
}

async function getRepoCommand(
	repo: import("../../types/config.js").NormalizedRepo,
	workspaceRoot: string,
	commandType: "test" | "lint" | "start"
): Promise<string | null> {
	// Use language discovery utility which uses plugins
	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	return await LanguageDiscovery.discoverCommand(
		repo,
		workspaceRoot,
		commandType,
		pluginManager
	);
}

async function runTestsSequential(
	repos: import("../../types/config.js").NormalizedRepo[],
	workspaceRoot: string,
	configManager: ConfigManager,
	failFast: boolean | undefined,
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>,
	failedRepos: Array<{ name: string; error: string }>,
	skippedRepos: Array<{ name: string; reason: string }>
): Promise<TestResult> {
	const config = await configManager.load();
	if (!config) {
		throw new Error("Config not loaded");
	}

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	let completed = 0;
	let failed = 0;
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

		try {
			messages.push({ type: "info", message: `Testing ${repo.name}...` });

			const commandRunner = await LanguageDiscovery.getCommandRunner(
				repo,
				workspaceRoot,
				configManager,
				pluginManager
			);

			// Run lint first if available
			const lintCommand = await getRepoCommand(
				repo,
				workspaceRoot,
				"lint"
			);
			if (lintCommand) {
				messages.push({ type: "dim", message: `  Linting...` });
				try {
					if (commandRunner.runner) {
						const [cmd, ...args] = lintCommand.split(/\s+/);
						await execa(
							commandRunner.runner,
							[...commandRunner.args, cmd, ...args],
							{
								cwd: repoPath,
								stdio: "inherit",
							}
						);
					} else {
						const [cmd, ...args] = lintCommand.split(/\s+/);
						await execa(cmd, args, {
							cwd: repoPath,
							stdio: "inherit",
						});
					}
					messages.push({ type: "success", message: `  ✓ Lint passed` });
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					messages.push({ type: "error", message: `  ✗ Lint failed` });
					failedRepos.push({ name: repo.name, error: errorMsg });
					failed++;
					if (failFast) {
						break;
					}
					continue; // Skip test if lint fails
				}
			}

			// Run test
			const testCommand = await getRepoCommand(
				repo,
				workspaceRoot,
				"test"
			);
			if (testCommand) {
				messages.push({ type: "dim", message: `  Testing...` });
				if (commandRunner.runner) {
					const [cmd, ...args] = testCommand.split(/\s+/);
					await execa(
						commandRunner.runner,
						[...commandRunner.args, cmd, ...args],
						{
							cwd: repoPath,
							stdio: "inherit",
						}
					);
				} else {
					const [cmd, ...args] = testCommand.split(/\s+/);
					await execa(cmd, args, {
						cwd: repoPath,
						stdio: "inherit",
					});
				}
				messages.push({ type: "success", message: `  ✓ Test passed` });
			} else {
				messages.push({ type: "dim", message: `  No test command configured` });
			}

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

	if (failed > 0) {
		messages.push({ type: "warn", message: `${failed} repository(ies) failed` });
	}

	return {
		success: failed === 0,
		completed,
		failed,
		skipped,
		totalRepos: repos.length,
		messages,
		failedRepos,
		skippedRepos,
	};
}

async function runTestsParallel(
	repos: import("../../types/config.js").NormalizedRepo[],
	workspaceRoot: string,
	configManager: ConfigManager,
	failFast: boolean | undefined,
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>,
	failedRepos: Array<{ name: string; error: string }>,
	skippedRepos: Array<{ name: string; reason: string }>
): Promise<TestResult> {
	const config = await configManager.load();
	if (!config) {
		throw new Error("Config not loaded");
	}

	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	const results = await Promise.all(
		repos.map(async (repo) => {
			const repoPath = join(workspaceRoot, repo.path);

			if (!existsSync(repoPath)) {
				const reason = "not cloned";
				messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
				skippedRepos.push({ name: repo.name, reason });
				return {
					success: false,
					repo: repo.name,
					error: "Not cloned",
					skipped: true,
				};
			}

			try {
				messages.push({ type: "info", message: `Testing ${repo.name}...` });

				const commandRunner = await LanguageDiscovery.getCommandRunner(
					repo,
					workspaceRoot,
					configManager,
					pluginManager
				);

				// Run lint first
				const lintCommand = await getRepoCommand(
					repo,
					workspaceRoot,
					"lint"
				);
				if (lintCommand) {
					messages.push({ type: "dim", message: `  Linting...` });
					if (commandRunner.runner) {
						const [cmd, ...args] = lintCommand.split(/\s+/);
						await execa(
							commandRunner.runner,
							[...commandRunner.args, cmd, ...args],
							{
								cwd: repoPath,
								stdio: "inherit",
							}
						);
					} else {
					const [cmd, ...args] = lintCommand.split(/\s+/);
						await execa(cmd, args, {
						cwd: repoPath,
						stdio: "inherit",
					});
					}
					messages.push({ type: "success", message: `  ✓ Lint passed` });
				}

				// Run test
				const testCommand = await getRepoCommand(
					repo,
					workspaceRoot,
					"test"
				);
				if (testCommand) {
					messages.push({ type: "dim", message: `  Testing...` });
					if (commandRunner.runner) {
						const [cmd, ...args] = testCommand.split(/\s+/);
						await execa(
							commandRunner.runner,
							[...commandRunner.args, cmd, ...args],
							{
								cwd: repoPath,
								stdio: "inherit",
							}
						);
					} else {
					const [cmd, ...args] = testCommand.split(/\s+/);
						await execa(cmd, args, {
						cwd: repoPath,
						stdio: "inherit",
					});
					}
					messages.push({ type: "success", message: `  ✓ Test passed` });
				}

				messages.push({ type: "success", message: `Completed ${repo.name}` });
				return { success: true, repo: repo.name, skipped: false };
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				messages.push({ type: "error", message: `Failed in ${repo.name}: ${errorMsg}` });
				failedRepos.push({ name: repo.name, error: errorMsg });
				return { success: false, repo: repo.name, error: errorMsg, skipped: false };
			}
		})
	);

	const failures = results.filter((r) => !r.success && !r.skipped);
	const completed = results.filter((r) => r.success).length;
	const failed = failures.length;
	const skipped = results.filter((r) => r.skipped).length;

	if (failed > 0) {
		messages.push({ type: "warn", message: `${failed} repository(ies) failed` });
	}

	return {
		success: failed === 0,
		completed,
		failed,
		skipped,
		totalRepos: repos.length,
		messages,
		failedRepos,
		skippedRepos,
	};
}
