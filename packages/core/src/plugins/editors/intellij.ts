import { EditorPlugin } from "../types.js";
import { BaselineConfig } from "../../types/config.js";

/**
 * Built-in IntelliJ IDEA / JetBrains IDE plugin.
 * Provides IntelliJ workspace/modules configuration.
 */
const intellijPlugin: EditorPlugin = {
	metadata: {
		id: "intellij",
		name: "IntelliJ IDEA",
		version: "1.0.0",
		description: "IntelliJ IDEA / JetBrains IDE workspace configuration",
		type: "editor",
		baselineVersion: "0.1.0",
	},

	async generateWorkspaceFile(
		config: BaselineConfig,
		workspaceRoot: string
	): Promise<{ file: string; content: string }> {
		// IntelliJ uses .idea/modules.xml for multi-module projects
		// For simplicity, we'll create a modules.xml file
		const { normalizeAllRepos } = await import("../../utils/config-helpers.js");
		const normalizedRepos = await normalizeAllRepos(config.packages || config.repos, workspaceRoot);
		const modules = normalizedRepos.map((repo) => ({
			filepath: repo.path.replace(/\\/g, "/"), // Normalize path separators
			name: repo.name,
		}));

		// Create modules.xml content
		const modulesContent = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="ProjectModuleManager">
    <modules>
${modules.map((m) => `      <module fileurl="file://${m.filepath}" filepath="${m.filepath}" />`).join("\n")}
    </modules>
  </component>
</project>
`;

		return {
			file: ".idea/modules.xml",
			content: modulesContent,
		};
	},
};

export default intellijPlugin;

