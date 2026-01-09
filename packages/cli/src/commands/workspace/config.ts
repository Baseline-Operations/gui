/**
 * CLI wrapper for config command
 */
import { configRepositories, ConfigOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function configCommand(
	options: ConfigOptions = {}
): Promise<void> {
	try {
		const result = await configRepositories(options);

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to generate config");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Configuration") && msg.message.includes("Summary")) {
					Logger.title(msg.message);
				} else if (msg.message.includes("Generating Project Configurations")) {
					Logger.title(msg.message);
				} else {
					Logger.info(msg.message);
				}
			} else if (msg.type === "success") {
				Logger.success(msg.message);
			} else if (msg.type === "error") {
				Logger.error(msg.message);
			} else if (msg.type === "warn") {
				Logger.warn(msg.message);
			} else if (msg.type === "dim") {
				Logger.dim(msg.message);
			}
		}

		if (!result.success) {
			process.exit(1);
		}
	} catch (error) {
		Logger.error(
			`Failed to generate config: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

