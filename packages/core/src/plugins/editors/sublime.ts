import { EditorPlugin } from "../types.js";
import { BaselineConfig } from "../../types/config.js";

/**
 * Built-in Sublime Text plugin.
 * Provides Sublime Text project configuration.
 */
const sublimePlugin: EditorPlugin = {
	metadata: {
		id: "sublime",
		name: "Sublime Text",
		version: "1.0.0",
		description: "Sublime Text project configuration",
		type: "editor",
		baselineVersion: "0.1.0",
	},

	async generateWorkspaceFile(
		config: BaselineConfig,
		workspaceRoot: string
	): Promise<{ file: string; content: string }> {
		const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
		const normalizedRepos = await normalizeAllRepos(config.packages || config.repos, workspaceRoot);
		const folders = normalizedRepos.map((repo) => ({
			name: repo.name,
			path: repo.path,
		}));

		const projectConfig = {
			folders,
			settings: {
				"file_exclude_patterns": [
					"**/.git",
					"**/node_modules",
					"**/dist",
					"**/build",
				],
			},
		};

		return {
			file: "baseline.sublime-project",
			content: JSON.stringify(projectConfig, null, 2) + "\n",
		};
	},
};

export default sublimePlugin;

