/**
 * CLI wrapper for add command
 */
import { addRepository, AddRepositoryOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";
import { ConfigManager } from "@baseline/core/config";

export async function addCommand(
	gitUrl: string,
	options: AddRepositoryOptions = {}
): Promise<void> {
	try {
		const configManager = new ConfigManager();
		const workspaceRoot = configManager.getWorkspaceRoot();
		
		const result = await addRepository(gitUrl, {
			...options,
			workspaceRoot,
		});

		if (!result.success) {
			Logger.error("Failed to add repository:");
			result.errors?.forEach((err) => Logger.error(`  ${err}`));
			process.exit(1);
			return;
		}

		Logger.success(`Added repository: ${result.repo.name}`);
		Logger.info(`  URL: ${result.repo.gitUrl}`);
		Logger.info(`  Path: ${result.repo.path}`);
	} catch (error) {
		Logger.error(
			`Failed to add repository: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

