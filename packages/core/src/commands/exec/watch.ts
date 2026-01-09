import { existsSync, watch } from "fs";
import { join, relative } from "path";
import { execa } from "execa";
import { ConfigManager } from "../../config/manager.js";
import { readFileSync } from "fs";
import { LanguageDiscovery } from "../../utils/language-discovery.js";
import { PluginManager } from "../../plugins/manager.js";

/**
 * Try to load chokidar if available (better performance for large repos).
 * Falls back to null if not installed.
 */
async function loadChokidar(): Promise<typeof import("chokidar") | null> {
	try {
		return await import("chokidar");
	} catch {
		return null;
	}
}

export interface WatchOptions {
	filter?: string;
	workspaceRoot?: string;
	onFileChange?: (repo: string, filePath: string) => void;
	onWatchStart?: (repo: string) => void;
	onWatchStop?: (repo: string) => void;
	onError?: (repo: string, error: string) => void;
}

export interface WatchResult {
	success: boolean;
	watchingCount: number;
	totalRepos: number;
	watchers: Array<{
		repo: string;
		watcher: ReturnType<typeof import("fs").watch> | { close: () => void } | null;
		cleanup: () => void;
	}>;
	messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }>;
	failedRepos: Array<{ name: string; error: string }>;
	skippedRepos: Array<{ name: string; reason: string }>;
	cleanup: () => Promise<void>;
}

/**
 * Watch library repositories for file changes and automatically run tests.
 * Only watches repositories marked as `library: true`.
 * Uses chokidar if available for better performance on large repositories.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function watchRepositories(
	options: WatchOptions = {}
): Promise<WatchResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn" | "dim"; message: string }> = [];
	const failedRepos: Array<{ name: string; error: string }> = [];
	const skippedRepos: Array<{ name: string; reason: string }> = [];
	const watchers: Array<{
		repo: string;
		watcher: ReturnType<typeof import("fs").watch> | { close: () => void } | null;
		cleanup: () => void;
	}> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			watchingCount: 0,
			totalRepos: 0,
			watchers: [],
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			failedRepos: [],
			skippedRepos: [],
			cleanup: async () => {},
		};
	}

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const allReposNormalized = normalizeAllRepos(config.packages || config.repos, workspaceRoot);
	
	let repos = allReposNormalized.filter((r) => r.library === true);

	// Apply additional filters if provided
	if (options.filter) {
		repos = filterRepos(repos, options.filter);
	}

	if (repos.length === 0) {
		return {
			success: true,
			watchingCount: 0,
			totalRepos: 0,
			watchers: [],
			messages: [
				{ type: "warn", message: "No library repositories found to watch." },
				{ type: "info", message: "Mark repositories as `library: true` in baseline.json to enable watching." },
			],
			failedRepos: [],
			skippedRepos: [],
			cleanup: async () => {},
		};
	}

	messages.push({ type: "info", message: "Watching Library Repositories" });
	messages.push({ type: "info", message: `Watching ${repos.length} library(ies)...` });

	// Try to load chokidar for better performance
	const chokidar = await loadChokidar();
	if (chokidar) {
		messages.push({ type: "dim", message: "Using chokidar for enhanced watch performance" });
	} else {
		messages.push({ type: "dim", message: "Using fs.watch (install chokidar for better performance on large repos)" });
	}

	// Setup watchers for each library
	const configManagerRef = configManager;
	for (const repo of repos) {
		const repoPath = join(workspaceRoot, repo.path);

		if (!existsSync(repoPath)) {
			const reason = "not cloned";
			messages.push({ type: "warn", message: `Skipping ${repo.name} (${reason})` });
			skippedRepos.push({ name: repo.name, reason });
			continue;
		}

		try {
			const watchConfig = getRepoWatchConfig(repo as import("../../types/config.js").NormalizedRepo, workspaceRoot);

			// Get ignore patterns
			const ignorePatterns = watchConfig?.ignore || [
				"**/node_modules/**",
				"**/.git/**",
				"**/dist/**",
				"**/build/**",
				"**/coverage/**",
				"**/.vitest/**",
			];

			// Convert ignore patterns to chokidar format
			const ignored = ignorePatterns.map((pattern: string) => {
				// Convert **/pattern to pattern for chokidar
				return pattern.replace(/^\*\*\//, "");
			});

			// Create debounce timeout reference per watcher
			let debounceTimeout: NodeJS.Timeout | null = null;

			const handleFileChange = async (filePath: string) => {
				const relativePath = relative(repoPath, filePath);

				// Check ignore patterns
				if (matchesPattern(relativePath, ignorePatterns)) {
					return;
				}

				// Check watch patterns (if specified)
				if (watchConfig?.patterns) {
					if (
						!matchesPattern(relativePath, watchConfig.patterns)
					) {
						return;
					}
				}

				// Get custom command from watch config, or default to test
				const customCommand = watchConfig?.customCommand;

				// Debounce: wait a bit before running command
				if (debounceTimeout) {
					clearTimeout(debounceTimeout);
				}
				debounceTimeout = setTimeout(async () => {
					if (options.onFileChange) {
						options.onFileChange(repo.name, relativePath);
					}
					try {
						const currentConfig =
							await configManagerRef.load();
						if (currentConfig) {
							if (customCommand) {
								await runCustomWatchCommand(
									repo,
									workspaceRoot,
									currentConfig,
									customCommand
								);
							} else {
								await runRepoTests(
									repo,
									workspaceRoot,
									currentConfig
								);
							}
						}
					} catch (error) {
						const errorMsg = error instanceof Error ? error.message : String(error);
						if (options.onError) {
							options.onError(repo.name, errorMsg);
						}
					}
				}, 500);
			};

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			let watcher: any = null;

			if (chokidar) {
				// Use chokidar for better performance on large repos
				watcher = chokidar.watch(repoPath, {
					ignored: ignored,
					persistent: true,
					ignoreInitial: true,
					followSymlinks: false,
				});

				if (watcher) {
					watcher
						.on("change", handleFileChange)
						.on("add", handleFileChange)
						.on("unlink", handleFileChange);
				}
			} else {
				// Fall back to fs.watch
				watcher = watch(
					repoPath,
					{ recursive: true },
					async (eventType, filename) => {
						if (!filename) return;
						const filePath =
							filename.startsWith("/") ? filename : (
								join(repoPath, filename)
							);
						await handleFileChange(filePath);
					}
				);
			}

			const cleanup = () => {
				if (debounceTimeout) {
					clearTimeout(debounceTimeout);
				}
				if (watcher) {
					if (chokidar && watcher.close) {
						// chokidar watcher
						watcher.close();
					} else if (watcher.close) {
						// fs.watch
						watcher.close();
					}
				}
				if (options.onWatchStop) {
					options.onWatchStop(repo.name);
				}
			};

			watchers.push({ repo: repo.name, watcher, cleanup });
			if (options.onWatchStart) {
				options.onWatchStart(repo.name);
			}
			messages.push({ type: "success", message: `Watching ${repo.name}` });
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed to watch ${repo.name}: ${errorMsg}` });
			failedRepos.push({ name: repo.name, error: errorMsg });
			if (options.onError) {
				options.onError(repo.name, errorMsg);
			}
		}
	}

	if (watchers.length === 0) {
		messages.push({ type: "warn", message: "No repositories are being watched." });
		return {
			success: failedRepos.length === 0,
			watchingCount: 0,
			totalRepos: repos.length,
			watchers: [],
			messages,
			failedRepos,
			skippedRepos,
			cleanup: async () => {},
		};
	}

	messages.push({ type: "info", message: "Watch Active" });
	messages.push({ type: "info", message: "Press Ctrl+C to stop watching." });

	const cleanupAll = async () => {
		for (const { cleanup } of watchers) {
			cleanup();
		}
	};

	return {
		success: failedRepos.length === 0,
		watchingCount: watchers.length,
		totalRepos: repos.length,
		watchers,
		messages,
		failedRepos,
		skippedRepos,
		cleanup: cleanupAll,
	};
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

async function runRepoTests(
	repo: import("../../types/config.js").NormalizedRepo,
	workspaceRoot: string,
	_config: { packageManager?: string }
): Promise<void> {
	const configManager = new ConfigManager();
	const pluginManager = PluginManager.getInstance();
	await pluginManager.initialize();

	const repoPath = join(workspaceRoot, repo.path);
	const commandRunner = await LanguageDiscovery.getCommandRunner(
		repo,
		workspaceRoot,
		configManager,
		pluginManager
	);

	// Run lint first if available
	const lintCommand = await getRepoCommand(repo, workspaceRoot, "lint");
	if (lintCommand) {
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
	}

	// Run test
	const testCommand = await getRepoCommand(repo, workspaceRoot, "test");
	if (testCommand) {
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
	}
}

function getRepoWatchConfig(
	repo: import("../../types/config.js").NormalizedRepo,
	workspaceRoot: string
): import("../../types/config.js").WatchConfig | undefined {
	const repoPath = join(workspaceRoot, repo.path);
	const projectConfigPath = join(repoPath, "baseline.project.json");

	// Check project config first
	if (existsSync(projectConfigPath)) {
		try {
			const projectConfig = JSON.parse(
				readFileSync(projectConfigPath, "utf-8")
			);
			if (projectConfig.watch) {
				return projectConfig.watch;
			}
		} catch {
			// Failed to parse project config
		}
	}

	// Check baseline.json repo config
	return repo.watch;
}

function matchesPattern(filePath: string, patterns: string[]): boolean {
	return patterns.some((pattern) => {
		// Simple glob pattern matching
		const regex = new RegExp(
			"^" +
				pattern
					.replace(/\*\*/g, ".*")
					.replace(/\*/g, "[^/]*")
					.replace(/\?/g, ".") +
				"$"
		);
		return regex.test(filePath);
	});
}

async function runCustomWatchCommand(
	repo: import("../../types/config.js").NormalizedRepo,
	workspaceRoot: string,
	config: { packageManager?: string },
	command: string
): Promise<void> {
	const repoPath = join(workspaceRoot, repo.path);
		const repoPM = repo.packageManager || config.packageManager || "npm";
	const [cmd, ...args] = command.split(/\s+/);

	await execa(repoPM, ["run", cmd, ...args], {
		cwd: repoPath,
		stdio: "inherit",
	});
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
