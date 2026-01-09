/**
 * CLI wrapper for docker-compose command
 */
import { dockerCompose, DockerComposeOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function dockerComposeCommand(
	subcommand: "up" | "down" | "start" | "stop" | "ps" | "logs",
	options: DockerComposeOptions = {}
): Promise<void> {
	try {
		const result = await dockerCompose(subcommand, options);

		if (!result.success && result.totalFiles === 0 && result.processed === 0) {
			// No workspace or no compose files
			for (const msg of result.messages) {
				if (msg.type === "error") {
					Logger.error(msg.message);
				} else if (msg.type === "info") {
					Logger.info(msg.message);
				} else if (msg.type === "warn") {
					Logger.warn(msg.message);
				}
			}
			process.exit(result.messages.some(m => m.type === "error") ? 1 : 0);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Docker Compose:")) {
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
			`Failed to run docker-compose: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

