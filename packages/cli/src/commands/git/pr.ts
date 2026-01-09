/**
 * CLI wrapper for PR create command
 */
import { createPullRequests, PrCreateOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function prCreateCommand(
	options: PrCreateOptions = {}
): Promise<void> {
	try {
		const result = await createPullRequests(options);

		if (!result.success && result.created === 0 && result.errors === 0) {
			// No workspace or no provider
			for (const msg of result.messages) {
				if (msg.type === "error") {
					Logger.error(msg.message);
				} else if (msg.type === "info") {
					Logger.info(msg.message);
				}
			}
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Summary")) {
					Logger.title(msg.message);
				} else if (msg.message.includes("Creating Pull Requests")) {
					Logger.title(msg.message);
				} else if (msg.message.startsWith("  ")) {
					// PR URL
					Logger.dim(msg.message);
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
			`Failed to create pull requests: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

