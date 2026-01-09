/**
 * CLI wrapper for branch command
 */
import { branchRepositories, BranchOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function branchCommand(
	branchName: string,
	options: BranchOptions = {}
): Promise<void> {
	try {
		const result = await branchRepositories(branchName, options);

		if (!result.success && result.errors > 0) {
			Logger.error(result.messages[0]?.message || "Failed to process branches");
			process.exit(1);
			return;
		}

		// Log title
		const titleMsg = result.messages.find((m) => m.message.includes("branch:"));
		if (titleMsg) {
			Logger.title(titleMsg.message);
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Summary")) {
					Logger.title(msg.message);
				} else if (!msg.message.includes("branch:")) {
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
			`Failed to process branches: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

