/**
 * CLI wrapper for test command
 */
import { runTests, TestOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function testCommand(
	options: TestOptions = {}
): Promise<void> {
	try {
		const result = await runTests(options);

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to run tests");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Running Tests")) {
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
			`Failed to run tests: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

