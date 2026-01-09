import { ConfigManager } from "../../config/manager.js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { NormalizedRepo } from "../../types/config.js";
import { normalizeAllRepos } from "../../utils/config-helpers.js";

export interface GraphOptions {
	format?: "text" | "dot" | "json";
	output?: string;
	workspaceRoot?: string;
}

export interface GraphResult {
	success: boolean;
	graph: Record<string, { name: string; dependencies: string[]; dependents: string[] }>;
	output: string;
	outputFile?: string;
	messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }>;
}

/**
 * Generate a dependency graph visualization for repositories.
 * Detects dependencies from package.json (Node.js), Cargo.toml (Rust), etc.
 * This is a pure function that returns results - no logging or process.exit.
 */
export async function generateGraph(
	options: GraphOptions = {}
): Promise<GraphResult> {
	const messages: Array<{ type: "info" | "success" | "error" | "warn"; message: string }> = [];
	
	let workspaceRoot = options.workspaceRoot;
	const configManager = workspaceRoot ? new ConfigManager(workspaceRoot) : new ConfigManager();
	
	if (!workspaceRoot) {
		workspaceRoot = configManager.getWorkspaceRoot();
	}
	
	const config = await configManager.load();

	if (!config) {
		return {
			success: false,
			graph: {},
			output: "",
			messages: [{ type: "error", message: "No baseline workspace found. Run `baseline init` first." }],
		};
	}

	if ((config.packages || config.repos || []).length === 0) {
		return {
			success: true,
			graph: {},
			output: "",
			messages: [{ type: "warn", message: "No repositories configured." }],
		};
	}

	messages.push({ type: "info", message: "Dependency Graph" });

	const format = options.format || "text";

	// Normalize repos (convert strings to objects)
	const normalizedRepos = await normalizeAllRepos(config.packages || config.repos, workspaceRoot);

	// Build dependency graph
	const graph: Record<
		string,
		{ name: string; dependencies: string[]; dependents: string[] }
	> = {};

	// Initialize graph nodes
	for (const repo of normalizedRepos) {
		graph[repo.name] = {
			name: repo.name,
			dependencies: [],
			dependents: [],
		};
	}

	// Detect dependencies for each repository
	for (const repo of normalizedRepos) {
		const repoPath = join(workspaceRoot, repo.path);
		const dependencies = await detectDependencies(
			repo,
			repoPath,
			normalizedRepos,
			workspaceRoot
		);

		graph[repo.name].dependencies = dependencies;

		// Update dependents (reverse edges)
		for (const dep of dependencies) {
			if (graph[dep]) {
				if (!graph[dep].dependents.includes(repo.name)) {
					graph[dep].dependents.push(repo.name);
				}
			}
		}
	}

	// Generate output
	let output: string;
	switch (format) {
		case "dot":
			output = generateDotGraph(graph);
			break;
		case "json":
			output = JSON.stringify(graph, null, 2);
			break;
		case "text":
		default:
			output = generateTextGraph(graph);
			break;
	}

	let outputFile: string | undefined;
	if (options.output) {
		writeFileSync(options.output, output);
		outputFile = options.output;
		messages.push({ type: "success", message: `Dependency graph written to ${options.output}` });
	} else {
		messages.push({ type: "info", message: "\n" + output });
	}

	return {
		success: true,
		graph,
		output,
		outputFile,
		messages,
	};
}

/**
 * Detect dependencies for a repository by checking package.json, Cargo.toml, etc.
 */
async function detectDependencies(
	repo: NormalizedRepo,
	repoPath: string,
	allRepos: NormalizedRepo[],
	workspaceRoot: string
): Promise<string[]> {
	const dependencies: string[] = [];

	if (!existsSync(repoPath)) {
		return dependencies;
	}

	// Check for Node.js dependencies (package.json)
	const packageJsonPath = join(repoPath, "package.json");
	if (existsSync(packageJsonPath)) {
		try {
			const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
			const allDeps = {
				...packageJson.dependencies,
				...packageJson.devDependencies,
				...packageJson.peerDependencies,
			};

			// Match workspace dependencies
			for (const [depName, depVersion] of Object.entries(allDeps)) {
				if (typeof depVersion === "string" && depVersion.startsWith("workspace:")) {
					// Workspace protocol dependency
					const workspaceDep = depVersion.replace(/^workspace:/, "").replace(/^\*$/, depName);
					const matchingRepo = allRepos.find((r) => {
						// Try to match by name or package.json name
						if (r.name === workspaceDep) return true;
						try {
							const otherPackageJsonPath = join(workspaceRoot, r.path, "package.json");
							if (existsSync(otherPackageJsonPath)) {
								const otherPackageJson = JSON.parse(readFileSync(otherPackageJsonPath, "utf-8"));
								return otherPackageJson.name === workspaceDep || otherPackageJson.name === depName;
							}
						} catch {
							// Ignore errors
						}
						return false;
					});

					if (matchingRepo && !dependencies.includes(matchingRepo.name)) {
						dependencies.push(matchingRepo.name);
					}
				} else {
					// Try to match by package name
					const matchingRepo = allRepos.find((r) => {
						if (r.name === depName) return true;
						try {
							const otherPackageJsonPath = join(workspaceRoot, r.path, "package.json");
							if (existsSync(otherPackageJsonPath)) {
								const otherPackageJson = JSON.parse(readFileSync(otherPackageJsonPath, "utf-8"));
								return otherPackageJson.name === depName;
							}
						} catch {
							// Ignore errors
						}
						return false;
					});

					if (matchingRepo && !dependencies.includes(matchingRepo.name)) {
						dependencies.push(matchingRepo.name);
					}
				}
			}
		} catch {
			// Failed to parse package.json
		}
	}

	// Check for Rust dependencies (Cargo.toml)
	const cargoTomlPath = join(repoPath, "Cargo.toml");
	if (existsSync(cargoTomlPath)) {
		try {
			const cargoToml = readFileSync(cargoTomlPath, "utf-8");
			// Simple parsing for workspace dependencies
			const workspaceDepMatch = cargoToml.match(/workspace\s*=\s*["']([^"']+)["']/g);
			if (workspaceDepMatch) {
				for (const match of workspaceDepMatch) {
					const depName = match.match(/["']([^"']+)["']/)?.[1];
					if (depName) {
						const matchingRepo = allRepos.find((r) => r.name === depName || r.path === depName);
						if (matchingRepo && !dependencies.includes(matchingRepo.name)) {
							dependencies.push(matchingRepo.name);
						}
					}
				}
			}

			// Check for path dependencies
			const pathDepMatch = cargoToml.match(/path\s*=\s*["']([^"']+)["']/g);
			if (pathDepMatch) {
				for (const match of pathDepMatch) {
					const depPath = match.match(/["']([^"']+)["']/)?.[1];
					if (depPath) {
						const resolvedPath = join(repoPath, depPath);
						const matchingRepo = allRepos.find((r) => {
							const otherPath = join(workspaceRoot, r.path);
							return resolvedPath.startsWith(otherPath) || otherPath.startsWith(resolvedPath);
						});
						if (matchingRepo && !dependencies.includes(matchingRepo.name)) {
							dependencies.push(matchingRepo.name);
						}
					}
				}
			}
		} catch {
			// Failed to parse Cargo.toml
		}
	}

	// Check for Python dependencies (pyproject.toml or requirements.txt)
	const pyprojectTomlPath = join(repoPath, "pyproject.toml");
	if (existsSync(pyprojectTomlPath)) {
		// TODO: Parse pyproject.toml for local dependencies
	}

	return dependencies;
}

/**
 * Generate a text representation of the dependency graph.
 */
function generateTextGraph(
	graph: Record<string, { name: string; dependencies: string[]; dependents: string[] }>
): string {
	const lines: string[] = [];

	// Find root nodes (no dependencies)
	const rootNodes = Object.values(graph).filter((node) => node.dependencies.length === 0);
	const hasDependencies = Object.values(graph).some((node) => node.dependencies.length > 0);

	if (!hasDependencies) {
		return "No dependencies detected between repositories.";
	}

	lines.push("Repository Dependencies:\n");

	for (const [repoName, node] of Object.entries(graph)) {
		if (node.dependencies.length > 0) {
			lines.push(`${repoName}`);
			for (const dep of node.dependencies) {
				lines.push(`  └── depends on: ${dep}`);
			}
			lines.push("");
		}
	}

	if (rootNodes.length > 0) {
		lines.push("\nRoot repositories (no dependencies):");
		for (const node of rootNodes) {
			lines.push(`  - ${node.name}`);
		}
	}

	const dependents = Object.values(graph).filter((node) => node.dependents.length > 0);
	if (dependents.length > 0) {
		lines.push("\nDependents:");
		for (const node of dependents) {
			lines.push(`  ${node.name} is used by: ${node.dependents.join(", ")}`);
		}
	}

	return lines.join("\n");
}

/**
 * Generate a DOT graph format for visualization.
 */
function generateDotGraph(
	graph: Record<string, { name: string; dependencies: string[]; dependents: string[] }>
): string {
	const lines = ["digraph RepositoryDependencies {", '  rankdir="LR";'];

	for (const [repoName, node] of Object.entries(graph)) {
		const safeName = repoName.replace(/[^a-zA-Z0-9]/g, "_");
		lines.push(`  "${safeName}" [label="${repoName}"];`);

		for (const dep of node.dependencies) {
			const safeDep = dep.replace(/[^a-zA-Z0-9]/g, "_");
			lines.push(`  "${safeName}" -> "${safeDep}";`);
		}
	}

	lines.push("}");
	return lines.join("\n");
}

