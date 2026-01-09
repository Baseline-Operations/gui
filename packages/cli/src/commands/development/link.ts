/**
 * CLI wrapper for link command
 */
import { linkRepositories, LinkOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function linkCommand(
	options: LinkOptions = {}
): Promise<void> {
	try {
		const result = await linkRepositories(options);

		if (!result.success) {
			Logger.error(result.messages[0]?.message || "Failed to link workspace");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Linking Workspace")) {
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
	} catch (error) {
		Logger.error(
			`Failed to link workspace: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

