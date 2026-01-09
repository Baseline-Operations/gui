/**
 * CLI wrapper for sync command
 */
import { syncRepositories } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function syncCommand(): Promise<void> {
	try {
		const result = await syncRepositories();

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to sync repositories");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Summary")) {
					Logger.title(msg.message);
				} else if (msg.message.includes("Syncing")) {
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
			`Failed to sync repositories: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

