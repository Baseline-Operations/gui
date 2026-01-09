/**
 * CLI wrapper for clone command
 */
import { cloneRepositories } from "@baseline/core/commands";
import { Logger, ProgressUtil } from "@baseline/core/utils";

export async function cloneCommand(): Promise<void> {
	Logger.title("Cloning Repositories");

	try {
		const result = await cloneRepositories();

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to clone repositories");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Summary")) {
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
			}
		}

		if (!result.success) {
			process.exit(1);
		}
	} catch (error) {
		Logger.error(
			`Failed to clone repositories: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

