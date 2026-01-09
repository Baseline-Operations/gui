import {
	PackageManagerPlugin,
} from "../types.js";
import { execa } from "execa";

/**
 * Built-in pip package manager plugin for Python.
 */
const pipPlugin: PackageManagerPlugin = {
	metadata: {
		id: "pip",
		name: "pip",
		version: "1.0.0",
		description: "pip package manager support for Python",
		type: "package-manager",
		baselineVersion: "0.1.0",
		requiresLanguages: ["python"],
	},

	async isInstalled(): Promise<boolean> {
		try {
			await execa("pip", ["--version"], { timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	},

	async getVersion(): Promise<string | null> {
		try {
			const { stdout } = await execa("pip", ["--version"], {
				timeout: 5000,
			});
			return stdout.trim().split(" ")[1] || null;
		} catch {
			return null;
		}
	},

	getInstallCommand(): string {
		return "pip install -r requirements.txt";
	},

	getRunCommand(): string[] {
		return ["python", "-m"]; // Python modules
	},

	async createWorkspaceConfig(
		_repos: Array<{ path: string; name: string }>,
		_workspaceRoot: string
	): Promise<{ file: string; content: string } | null> {
		// Python doesn't have a standard workspace file like npm/yarn
		// Could create a requirements.txt that includes all repos, but that's uncommon
		// For now, return null as Python repos are typically independent
		return null;
	},
};

export default pipPlugin;

