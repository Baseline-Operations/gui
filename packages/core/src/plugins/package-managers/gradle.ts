import {
	PackageManagerPlugin,
} from "../types.js";
import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Built-in Gradle package manager plugin for Java.
 */
const gradlePlugin: PackageManagerPlugin = {
	metadata: {
		id: "gradle",
		name: "Gradle",
		version: "1.0.0",
		description: "Gradle build tool support for Java",
		type: "package-manager",
		baselineVersion: "0.1.0",
		requiresLanguages: ["java"],
	},

	async isInstalled(): Promise<boolean> {
		try {
			await execa("gradle", ["--version"], { timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	},

	async getVersion(): Promise<string | null> {
		try {
			const { stdout } = await execa("gradle", ["--version"], {
				timeout: 5000,
			});
			const match = stdout.match(/Gradle (\d+\.\d+(\.\d+)?)/);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	},

	getInstallCommand(): string {
		return "gradle build";
	},

	getRunCommand(): string[] {
		return ["gradle"];
	},

	async createWorkspaceConfig(
		repos: Array<{ path: string; name: string }>,
		workspaceRoot: string
	): Promise<{ file: string; content: string } | null> {
		const includedProjects = repos
			.filter((r) =>
				existsSync(join(workspaceRoot, r.path, "build.gradle")) ||
				existsSync(join(workspaceRoot, r.path, "build.gradle.kts"))
			)
			.map((r) => `"${r.path}"`);

		if (includedProjects.length === 0) {
			return null;
		}

		const content = `rootProject.name = "baseline-workspace"

include ${includedProjects.join("\ninclude ")}
`;

		return {
			file: "settings.gradle",
			content,
		};
	},
};

export default gradlePlugin;

