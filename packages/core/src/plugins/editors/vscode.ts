import { EditorPlugin } from "../types.js";
import { BaselineConfig } from "../../types/config.js";

/**
 * Built-in VS Code editor plugin.
 * Provides VS Code workspace file generation.
 */
const vscodePlugin: EditorPlugin = {
	metadata: {
		id: "vscode",
		name: "VS Code",
		version: "1.0.0",
		description: "VS Code workspace file generation",
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
			file: "workspace.code-workspace",
			content: JSON.stringify(workspaceConfig, null, 2) + "\n",
		};
	},
};

export default vscodePlugin;

