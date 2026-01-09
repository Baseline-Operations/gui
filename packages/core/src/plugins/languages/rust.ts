import {
	LanguagePlugin,
	LanguagePluginOptions,
} from "../types.js";
import { LanguageProfile } from "../types.js";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Built-in Rust language plugin.
 */
const rustPlugin: LanguagePlugin = {
	metadata: {
		id: "rust",
		name: "Rust",
		version: "1.0.0",
		description: "Rust language support with version policies",
		type: "language",
	},

	getLanguageProfile(
		options: LanguagePluginOptions = {}
	): LanguageProfile {
		const toolchain = [
			{
				name: "rustc",
				versionPolicy: options.versionPolicies?.rustc,
			},
		];

		// Add cargo if available
		if (options.versionPolicies?.cargo) {
			toolchain.push({
				name: "cargo",
				versionPolicy: options.versionPolicies.cargo,
			});
		}

		return {
			displayName: "Rust",
			toolchain,
			projectMarkers: ["Cargo.toml", "Cargo.lock"],
		};
	},

	getDetectionCommand(toolName: string): { command: string; args?: string[] } | null {
		const detectionMap: Record<string, { command: string; args?: string[] }> = {
			rustc: { command: "rustc", args: ["--version"] },
			cargo: { command: "cargo", args: ["--version"] },
		};
		return detectionMap[toolName] || null;
	},

	async detectLanguage(repoPath: string): Promise<boolean> {
		// Check for Rust project markers
		return (
			existsSync(join(repoPath, "Cargo.toml")) ||
			existsSync(join(repoPath, "Cargo.lock"))
		);
	},
};

export default rustPlugin;
