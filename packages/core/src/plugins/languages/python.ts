import {
	LanguagePlugin,
	LanguagePluginOptions,
} from "../types.js";
import { LanguageProfile } from "../types.js";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Built-in Python language plugin.
 */
const pythonPlugin: LanguagePlugin = {
	metadata: {
		id: "python",
		name: "Python",
		version: "1.0.0",
		description: "Python support with version policies",
		type: "language",
	},

	getLanguageProfile(
		options: LanguagePluginOptions = {}
	): LanguageProfile {
		const toolchain = [
			{
				name: "python",
				versionPolicy: options.versionPolicies?.python,
			},
		];

		// Add pip if available
		if (options.versionPolicies?.pip) {
			toolchain.push({
				name: "pip",
				versionPolicy: options.versionPolicies.pip,
			});
		}

		return {
			displayName: "Python",
			toolchain,
			projectMarkers: [
				"requirements.txt",
				"pyproject.toml",
				"setup.py",
				"Pipfile",
			],
		};
	},

	getDetectionCommand(toolName: string): { command: string; args?: string[] } | null {
		const detectionMap: Record<string, { command: string; args?: string[] }> = {
			python: { command: "python3", args: ["--version"] },
			pip: { command: "pip3", args: ["--version"] },
		};
		return detectionMap[toolName] || null;
	},

	async detectLanguage(repoPath: string): Promise<boolean> {
		// Check for Python project markers
		const markers = [
			"requirements.txt",
			"pyproject.toml",
			"setup.py",
			"Pipfile",
		];
		return markers.some((marker) =>
			existsSync(join(repoPath, marker))
		);
	},
};

export default pythonPlugin;
