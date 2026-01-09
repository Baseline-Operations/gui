/**
 * CLI wrapper for graph command
 */
import { generateGraph, GraphOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function graphCommand(
	options: GraphOptions = {}
): Promise<void> {
	try {
		const result = await generateGraph(options);

		if (!result.success) {
			Logger.error(result.messages[0]?.message || "Failed to generate graph");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message === "Dependency Graph") {
					Logger.title(msg.message);
				} else if (msg.message.startsWith("\n")) {
					// Output graph
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
			}
		}
	} catch (error) {
		Logger.error(
			`Failed to generate graph: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

