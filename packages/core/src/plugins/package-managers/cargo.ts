import {
	PackageManagerPlugin,
} from "../types.js";
import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Built-in Cargo package manager plugin for Rust.
 */
const cargoPlugin: PackageManagerPlugin = {
	metadata: {
		id: "cargo",
		name: "Cargo",
		version: "1.0.0",
		description: "Cargo package manager support for Rust",
		type: "package-manager",
		baselineVersion: "0.1.0",
		requiresLanguages: ["rust"],
	},

	async isInstalled(): Promise<boolean> {
		try {
			await execa("cargo", ["--version"], { timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	},

	async getVersion(): Promise<string | null> {
		try {
			const { stdout } = await execa("cargo", ["--version"], {
				timeout: 5000,
			});
			return stdout.trim().split(" ")[1] || null;
		} catch {
			return null;
		}
	},

	getInstallCommand(): string {
		return "cargo build";
	},

	getRunCommand(): string[] {
		return ["cargo", "run", "--"];
	},

	async createWorkspaceConfig(
		repos: Array<{ path: string; name: string }>,
		workspaceRoot: string
	): Promise<{ file: string; content: string } | null> {
		const workspaceConfig: any = {
			workspace: {
				members: [],
			},
		};

		const members = repos
			.filter((r) => existsSync(join(workspaceRoot, r.path, "Cargo.toml")))
			.map((r) => r.path);

		if (members.length === 0) {
			return null;
		}

		workspaceConfig.workspace.members = members;

		// Cargo workspace uses Cargo.toml format
		const content = `[workspace]
members = ${JSON.stringify(members, null, 2).replace(/^/gm, "  ")}
`;

		return {
			file: "Cargo.toml",
			content,
		};
	},
};

export default cargoPlugin;

