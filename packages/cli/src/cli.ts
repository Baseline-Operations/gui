#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getCommandName } from "@baseline/core/utils";
import { ConfigManager } from "@baseline/core/config";

// Import CLI command wrappers
import { initCommand } from "./commands/workspace/init.js";
import { addCommand } from "./commands/workspace/add.js";
import { cloneCommand } from "./commands/git/clone.js";
import { syncCommand } from "./commands/git/sync.js";
import { statusCommand } from "./commands/git/status.js";
import { branchCommand } from "./commands/git/branch.js";
import { prCreateCommand } from "./commands/git/pr.js";
import { configCommand } from "./commands/workspace/config.js";
import { graphCommand } from "./commands/workspace/graph.js";
import { doctorCommand } from "./commands/workspace/doctor.js";
import { execCommand } from "./commands/exec/exec.js";
import { testCommand } from "./commands/exec/test.js";
import { lintCommand } from "./commands/exec/lint.js";
import { startCommand } from "./commands/exec/start.js";
import { watchCommand } from "./commands/exec/watch.js";
import { dockerComposeCommand } from "./commands/exec/docker-compose.js";
import { linkCommand } from "./commands/development/link.js";
import { releaseCommand } from "./commands/development/release.js";
import {
	pluginInstallCommand,
	pluginListCommand,
	pluginRemoveCommand,
	pluginInstallAllCommand,
	pluginSearchCommand,
} from "./commands/plugin/plugin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getVersion(): Promise<string> {
	try {
		const packageJsonPath = join(__dirname, "../package.json");
		const packageJson = JSON.parse(
			await readFile(packageJsonPath, "utf-8")
		);
		return packageJson.version || "0.1.0";
	} catch {
		return "0.1.0";
	}
}

async function main() {
	const version = await getVersion();
	
	// Get command name (check env var, then .baseline/command file, then default to "bl")
	const workspaceRoot = ConfigManager.findWorkspaceRoot() || process.cwd();
	const commandName = getCommandName(workspaceRoot);

	const program = new Command();

	program
		.name(commandName)
		.description("Manage multiple Git repositories as a single coordinated workspace")
		.version(version);

	// init
	program
		.command("init")
		.alias("i")
		.description("Initialize a new baseline workspace")
		.action(async () => {
			try {
				await initCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// add
	program
		.command("add <gitUrl>")
		.alias("a")
		.description("Add a repository to the workspace")
		.option("-n, --name <name>", "Repository name")
		.option("-p, --path <path>", "Repository path")
		.option("-t, --tags <tags...>", "Repository tags")
		.option("-l, --languages <languages...>", "Repository languages")
		.option("--package-manager <pm>", "Package manager (npm|pnpm|yarn)")
		.option("--library", "Mark as library")
		.option("--test <cmd>", "Test command")
		.option("--lint <cmd>", "Lint command")
		.option("--start <cmd>", "Start command")
		.option("--start-in-docker", "Start in Docker")
		.option("--docker-image <image>", "Docker image")
		.option("--required-plugins <plugins...>", "Required plugins")
		.action(async (gitUrl, options) => {
			try {
				await addCommand(gitUrl, options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// clone
	program
		.command("clone")
		.alias("c")
		.description("Clone all repositories")
		.action(async () => {
			try {
				await cloneCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// sync
	program
		.command("sync")
		.alias("s")
		.description("Sync all repositories (fetch and pull)")
		.action(async () => {
			try {
				await syncCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// status
	program
		.command("status")
		.alias("st")
		.description("Show status of all repositories")
		.action(async () => {
			try {
				await statusCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// branch
	program
		.command("branch <name>")
		.alias("b")
		.description("Create or checkout a branch across repositories")
		.option("--create", "Create new branch")
		.action(async (name, options) => {
			try {
				await branchCommand(name, options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// pr
	const prCmd = program
		.command("pr")
		.alias("p")
		.description("Pull request operations");

	prCmd
		.command("create")
		.description("Create pull requests")
		.option("-r, --repo <repo>", "Specific repository")
		.option("-t, --title <title>", "PR title")
		.option("-b, --body <body>", "PR body")
		.option("--draft", "Create as draft")
		.action(async (options) => {
			try {
				await prCreateCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// exec
	program
		.command("exec <command>")
		.alias("x")
		.description("Execute a command across repositories")
		.option("--filter <filter>", "Filter repositories")
		.option("--parallel", "Run in parallel")
		.option("--fail-fast", "Stop on first error")
		.action(async (command, options) => {
			try {
				await execCommand(command, options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// doctor
	program
		.command("doctor")
		.alias("d")
		.description("Validate workspace configuration")
		.action(async () => {
			try {
				await doctorCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// link
	program
		.command("link")
		.alias("l")
		.description("Link repositories using workspace protocols")
		.action(async () => {
			try {
				await linkCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// release
	const releaseCmd = program
		.command("release")
		.alias("r")
		.description("Release management");

	releaseCmd
		.command("plan")
		.description("Show release plan")
		.action(async () => {
			try {
				await releaseCommand("plan");
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	releaseCmd
		.command("version")
		.description("Bump versions")
		.action(async () => {
			try {
				await releaseCommand("version");
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	releaseCmd
		.command("publish")
		.description("Publish packages")
		.action(async () => {
			try {
				await releaseCommand("publish");
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// config
	program
		.command("config")
		.alias("cf")
		.description("Generate project configuration files")
		.option("--repo <repo>", "Generate config for specific repository")
		.option("--force", "Overwrite existing configuration files")
		.action(async (options) => {
			try {
				await configCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// graph
	program
		.command("graph")
		.alias("g")
		.description("Generate dependency graph visualization")
		.option("--format <format>", "Output format (text, dot, json)", "text")
		.option("--output <file>", "Output file (default: stdout)")
		.action(async (options) => {
			try {
				await graphCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// test
	program
		.command("test")
		.alias("t")
		.description("Run tests and linting across repositories")
		.option("--filter <filter>", "Filter repositories")
		.option("--parallel", "Run in parallel")
		.option("--fail-fast", "Stop on first error")
		.action(async (options) => {
			try {
				await testCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// lint
	program
		.command("lint")
		.alias("li")
		.description("Run linting across repositories")
		.option("--filter <filter>", "Filter repositories")
		.option("--parallel", "Run in parallel")
		.option("--fail-fast", "Stop on first error")
		.action(async (options) => {
			try {
				await lintCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// start
	program
		.command("start")
		.alias("st")
		.description("Start applications")
		.option("--filter <filter>", "Filter repositories")
		.action(async (options) => {
			try {
				await startCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// watch
	program
		.command("watch")
		.alias("w")
		.description("Watch library repositories for changes and run tests")
		.option("--filter <filter>", "Additional filter for repositories")
		.action(async (options) => {
			try {
				await watchCommand(options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// docker-compose
	const dockerCmd = program
		.command("docker-compose")
		.alias("dc")
		.description("Manage docker-compose services across repositories");

	dockerCmd
		.command("up")
		.description("Start docker-compose services")
		.option("-f, --file <file>", "Compose file name (default: docker-compose.yml)")
		.option("-d, --detach", "Detached mode: run in background")
		.option("--build", "Build images before starting")
		.option("--services <services...>", "Service names to start")
		.action(async (options) => {
			try {
				await dockerComposeCommand("up", options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	dockerCmd
		.command("down")
		.description("Stop and remove docker-compose services")
		.option("-f, --file <file>", "Compose file name (default: docker-compose.yml)")
		.action(async (options) => {
			try {
				await dockerComposeCommand("down", options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	dockerCmd
		.command("start")
		.description("Start existing docker-compose services")
		.option("-f, --file <file>", "Compose file name (default: docker-compose.yml)")
		.option("--services <services...>", "Service names to start")
		.action(async (options) => {
			try {
				await dockerComposeCommand("start", options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	dockerCmd
		.command("stop")
		.description("Stop docker-compose services")
		.option("-f, --file <file>", "Compose file name (default: docker-compose.yml)")
		.option("--services <services...>", "Service names to stop")
		.action(async (options) => {
			try {
				await dockerComposeCommand("stop", options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	dockerCmd
		.command("ps")
		.description("List docker-compose services")
		.option("-f, --file <file>", "Compose file name (default: docker-compose.yml)")
		.action(async (options) => {
			try {
				await dockerComposeCommand("ps", options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	dockerCmd
		.command("logs")
		.description("View docker-compose logs")
		.option("-f, --file <file>", "Compose file name (default: docker-compose.yml)")
		.option("--services <services...>", "Service names to show logs for")
		.action(async (options) => {
			try {
				await dockerComposeCommand("logs", options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	// plugin
	const pluginCmd = program
		.command("plugin")
		.alias("pl")
		.description("Manage plugins");

	pluginCmd
		.command("install <pluginId>")
		.description("Install a plugin")
		.option("--version <version>", "Plugin version")
		.option("--source <source>", "Plugin source (npm|git|local|remote)")
		.option("--url <url>", "Plugin URL")
		.option("--path <path>", "Plugin path (for local)")
		.option("--no-save", "Don't save to baseline.json")
		.action(async (pluginId, options) => {
			try {
				await pluginInstallCommand(pluginId, options);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	pluginCmd
		.command("list")
		.description("List installed plugins")
		.action(async () => {
			try {
				await pluginListCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	pluginCmd
		.command("remove <pluginId>")
		.description("Remove a plugin")
		.action(async (pluginId) => {
			try {
				await pluginRemoveCommand(pluginId);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	pluginCmd
		.command("install-all")
		.description("Install all plugins from baseline.json")
		.action(async () => {
			try {
				await pluginInstallAllCommand();
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	pluginCmd
		.command("search <query>")
		.description("Search for plugins")
		.option("--registry", "Search plugin registry instead of npm")
		.action(async (query, options) => {
			try {
				await pluginSearchCommand(query, { registry: options.registry });
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : String(error)}`
				);
				process.exit(1);
			}
		});

	program.parse();
}

main().catch((error) => {
	console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});

