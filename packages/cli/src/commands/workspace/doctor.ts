/**
 * CLI wrapper for doctor command
 */
import { doctorCheck, DoctorOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function doctorCommand(
	options: DoctorOptions = {}
): Promise<void> {
	try {
		const result = await doctorCheck(options);

		if (!result.success && result.messages.length === 1 && result.messages[0].type === "error") {
			Logger.error(result.messages[0].message);
			process.exit(1);
			return;
		}

		// Log all messages
		let currentCategory = "";
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.category === "title") {
					Logger.title(msg.message);
					currentCategory = msg.message;
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

		process.exit(result.success ? 0 : 1);
	} catch (error) {
		Logger.error(
			`Failed to run doctor: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

