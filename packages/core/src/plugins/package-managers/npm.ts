import {
	PackageManagerPlugin,
} from "../types.js";
import { execa } from "execa";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Built-in npm package manager plugin.
 * Provides npm workspace support.
 */
const npmPlugin: PackageManagerPlugin = {
	metadata: {
		id: "npm",
		name: "npm",
		version: "1.0.0",
		description: "npm package manager support",
		type: "package-manager",
		baselineVersion: "0.1.0",
		requiresLanguages: ["node"],
	},

	async isInstalled(): Promise<boolean> {
		try {
			await execa("npm", ["--version"], { timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	},

	async getVersion(): Promise<string | null> {
		try {
			const { stdout } = await execa("npm", ["--version"], {
				timeout: 5000,
			});
			return stdout.trim();
		} catch {
			return null;
		}
	},

	getInstallCommand(): string {
		return "npm install";
	},

	getRunCommand(): string[] {
		return ["npm", "run"];
	},

	async createWorkspaceConfig(
		repos: Array<{ path: string; name: string }>,
		workspaceRoot: string
	): Promise<{ file: string; content: string } | null> {
		const packageJsonPath = join(workspaceRoot, "package.json");
		let packageJson: any = {};

		if (existsSync(packageJsonPath)) {
			try {
				const content = readFileSync(packageJsonPath, "utf-8");
				packageJson = JSON.parse(content);
			} catch {
				// Failed to parse, will create new one
			}
		}

		const packagePaths = repos
			.filter((r) => existsSync(join(workspaceRoot, r.path, "package.json")))
			.map((r) => r.path);

		packageJson.name = packageJson.name || "baseline-workspace";
		packageJson.version = packageJson.version || "0.1.0";
		packageJson.private = packageJson.private ?? true;
		packageJson.workspaces = packagePaths;

		if (packagePaths.length === 0) {
			return null;
		}

		return {
			file: "package.json",
			content: JSON.stringify(packageJson, null, 2) + "\n",
		};
	},
};

export default npmPlugin;

