import { EditorPlugin } from "../types.js";
import { BaselineConfig } from "../../types/config.js";

/**
 * Built-in Cursor editor plugin.
 * Provides Cursor workspace file generation.
 */
const cursorPlugin: EditorPlugin = {
	metadata: {
		id: "cursor",
		name: "Cursor",
		version: "1.0.0",
		description: "Cursor workspace file generation",
		type: "editor",
		baselineVersion: "0.1.0",
	},

	async generateWorkspaceFile(
		config: BaselineConfig,
		workspaceRoot: string
	): Promise<{ file: string; content: string }> {
		// Cursor uses the same format as VS Code
		const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
		const normalizedRepos = await normalizeAllRepos(config.packages || config.repos, workspaceRoot);
		const folders = normalizedRepos.map((repo) => ({
			name: repo.name,
			path: repo.path,
		}));

		const workspaceConfig = {
			folders,
			settings: {
				"files.exclude": {
					"**/.git": true,
					"**/node_modules": true,
				},
			},
		};

		return {
			file: ".cursor-workspace",
			content: JSON.stringify(workspaceConfig, null, 2) + "\n",
		};
	},
};

export default cursorPlugin;

