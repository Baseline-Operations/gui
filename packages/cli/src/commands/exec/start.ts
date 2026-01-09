/**
 * CLI wrapper for start command
 */
import { startApplications, StartOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function startCommand(
	options: StartOptions = {}
): Promise<void> {
	try {
		const result = await startApplications(options);

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to start applications");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Starting Applications")) {
					Logger.title(msg.message);
				} else if (msg.message.includes("Summary")) {
					Logger.title(msg.message);
				} else if (msg.message === "\nApplications running in background. Press Ctrl+C to stop.") {
					Logger.log(msg.message);
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
			`Failed to start applications: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

