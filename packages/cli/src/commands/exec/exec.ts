/**
 * CLI wrapper for exec command
 */
import { executeCommand, ExecOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function execCommand(
	command: string,
	options: ExecOptions = {}
): Promise<void> {
	try {
		const result = await executeCommand(command, options);

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to execute command");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Executing:")) {
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
			`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

