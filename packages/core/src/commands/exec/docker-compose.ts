import { ConfigManager } from "../../config/manager.js";
import { existsSync } from "fs";
import { join } from "path";
import { execa } from "execa";

export interface DockerComposeOptions {
	file?: string;
	services?: string[];
	detach?: boolean;
	build?: boolean;
	workspaceRoot?: string;
}

export interface DockerComposeResult {
	success: boolean;
	subcommand: string;
	processed: number;
	failed: number;
	totalFiles: number;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
	failedRepos: Array<{ name: string; error: string }>;
}

/**
 * Manage docker-compose services across repositories.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function dockerCompose(
	subcommand: "up" | "down" | "start" | "stop" | "ps" | "logs",
	options: DockerComposeOptions = {}
): Promise<DockerComposeResult> {
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
			subcommand,
			processed: 0,
			failed: 0,
			totalFiles: 0,
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
			failedRepos: [],
		};
	}

	if ((config.packages || config.repos || []).length === 0) {
		return {
			success: true,
			subcommand,
			processed: 0,
			failed: 0,
			totalFiles: 0,
			messages: [{ type: "warn", message: "No repositories configured." }],
			failedRepos: [],
		};
	}

	messages.push({ type: "info", message: `Docker Compose: ${subcommand}` });

	// Normalize repos (convert strings to objects)
	const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
	const normalizedRepos = normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	const composeFiles: Array<{ repo: string; file: string; path: string }> = [];

	// Find docker-compose files in repositories
	for (const repo of normalizedRepos) {
		const repoPath = join(workspaceRoot, repo.path);
		if (!existsSync(repoPath)) {
			continue;
		}

		const defaultFile = options.file || "docker-compose.yml";
		const composeFile = join(repoPath, defaultFile);
		
		// Also check docker-compose.yaml
		const composeFileYaml = join(repoPath, "docker-compose.yaml");
		
		if (existsSync(composeFile)) {
			composeFiles.push({
				repo: repo.name,
				file: defaultFile,
				path: repoPath,
			});
		} else if (existsSync(composeFileYaml)) {
			composeFiles.push({
				repo: repo.name,
				file: "docker-compose.yaml",
				path: repoPath,
			});
		}
	}

	if (composeFiles.length === 0) {
		return {
			success: true,
			subcommand,
			processed: 0,
			failed: 0,
			totalFiles: 0,
			messages: [
				{ type: "warn", message: "No docker-compose.yml files found in repositories." },
				{ type: "info", message: "Tip: Place docker-compose.yml or docker-compose.yaml in repository root directories." },
			],
			failedRepos: [],
		};
	}

	messages.push({ type: "info", message: `Found ${composeFiles.length} docker-compose file(s)` });

	// Check if docker-compose is available
	try {
		await execa("docker-compose", ["--version"], { timeout: 5000 });
	} catch {
		try {
			await execa("docker", ["compose", "version"], { timeout: 5000 });
		} catch {
			return {
				success: false,
				subcommand,
				processed: 0,
				failed: 0,
				totalFiles: composeFiles.length,
				messages: [{ type: "error", message: "Docker Compose is not installed. Install it from https://docs.docker.com/compose/install/" }],
				failedRepos: [],
			};
		}
	}

	// Execute docker-compose commands
	const useDockerComposePlugin = await checkDockerComposePlugin();
	let processed = 0;
	let failed = 0;

	for (const compose of composeFiles) {
		try {
			messages.push({ type: "info", message: `Running ${subcommand} for ${compose.repo}...` });

			const args = buildDockerComposeArgs(
				subcommand,
				compose.file,
				options,
				compose.path
			);

			if (useDockerComposePlugin) {
				await execa("docker", ["compose", ...args], {
					cwd: compose.path,
					stdio: "inherit",
				});
			} else {
				await execa("docker-compose", args, {
					cwd: compose.path,
					stdio: "inherit",
				});
			}

			messages.push({ type: "success", message: `Completed ${subcommand} for ${compose.repo}` });
			processed++;
		} catch (error) {
			failed++;
			const errorMsg = error instanceof Error ? error.message : String(error);
			messages.push({ type: "error", message: `Failed ${subcommand} for ${compose.repo}: ${errorMsg}` });
			failedRepos.push({ name: compose.repo, error: errorMsg });
		}
	}

	return {
		success: failed === 0,
		subcommand,
		processed,
		failed,
		totalFiles: composeFiles.length,
		messages,
		failedRepos,
	};
}

/**
 * Check if docker compose plugin is available (preferred over docker-compose standalone).
 */
async function checkDockerComposePlugin(): Promise<boolean> {
	try {
		await execa("docker", ["compose", "version"], { timeout: 5000 });
		return true;
	} catch {
		return false;
	}
}

/**
 * Build docker-compose command arguments.
 */
function buildDockerComposeArgs(
	subcommand: string,
	composeFile: string,
	options: DockerComposeOptions,
	_composePath: string
): string[] {
	const args: string[] = [];

	// Add file flag if not using default name
	if (composeFile !== "docker-compose.yml") {
		args.push("-f", composeFile);
	}

	// Subcommand-specific arguments
	switch (subcommand) {
		case "up":
			if (options.detach) {
				args.push("-d");
			}
			if (options.build) {
				args.push("--build");
			}
			if (options.services && options.services.length > 0) {
				args.push(...options.services);
			}
			break;
		case "start":
			if (options.services && options.services.length > 0) {
				args.push(...options.services);
			}
			break;
		case "stop":
			if (options.services && options.services.length > 0) {
				args.push(...options.services);
			}
			break;
		case "logs":
			if (options.services && options.services.length > 0) {
				args.push(...options.services);
			}
			break;
	}

	args.push(subcommand);
	return args;
}

