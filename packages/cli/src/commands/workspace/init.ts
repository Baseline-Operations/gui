/**
 * CLI wrapper for init command
 * Imports the core function and handles CLI-specific concerns (logging, exit codes)
 */
import { initWorkspace, InitOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";
import { getCommandName } from "@baseline/core/utils";

export async function initCommand(options: InitOptions = {}): Promise<void> {
	Logger.title("Baseline Workspace Setup");

	try {
		const result = await initWorkspace(options);

		if (!result.success) {
			Logger.error("Failed to initialize workspace:");
			result.errors?.forEach((err) => Logger.error(`  ${err}`));
			process.exit(1);
			return;
		}

		// Log success messages
		Logger.success(`Created ${result.configPath}`);
		result.generatedFiles.forEach((file) => {
			Logger.success(`Created ${file}`);
		});

		Logger.title("Setup Complete!");
		Logger.info("Next steps:");
		const commandName = getCommandName(result.workspaceRoot);
		Logger.log(
			`  1. Run \`${commandName} add <gitUrl>\` to add repositories`
		);
		Logger.log(
			`  2. Run \`${commandName} clone\` to clone all repositories`
		);
		Logger.log("  3. Run `baseline status` to check repository status");
	} catch (error) {
		Logger.error(
			`Failed to initialize workspace: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

