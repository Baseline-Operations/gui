/**
 * CLI wrapper for watch command
 */
import { watchRepositories, WatchOptions } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function watchCommand(
	options: WatchOptions = {}
): Promise<void> {
	try {
		const watchOptions: WatchOptions = {
			...options,
			onFileChange: (repo: string, filePath: string) => {
				Logger.section(`Change detected in ${repo}: ${filePath}`);
			},
			onWatchStart: (repo: string) => {
				Logger.success(`Watching ${repo}`);
			},
			onWatchStop: (repo: string) => {
				Logger.success(`Stopped watching ${repo}`);
			},
			onError: (repo: string, error: string) => {
				Logger.error(`Failed to run watch command for ${repo}: ${error}`);
			},
		};

		const result = await watchRepositories(watchOptions);

		if (!result.success && result.totalRepos === 0) {
			Logger.error(result.messages[0]?.message || "Failed to watch repositories");
			process.exit(1);
			return;
		}

		// Log all messages
		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Watching Library Repositories") || msg.message.includes("Watch Active")) {
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

		if (result.watchingCount === 0) {
			// No watchers to keep alive
			if (!result.success) {
				process.exit(1);
			}
			return;
		}

		// Keep process alive and handle SIGINT
		process.on("SIGINT", async () => {
			Logger.info("\nStopping watchers...");
			await result.cleanup();
			Logger.success("All watchers stopped");
			process.exit(0);
		});

		// Keep process alive indefinitely
		// The process will exit when SIGINT is received
		await new Promise(() => {
			// Keep alive forever
		});
	} catch (error) {
		Logger.error(
			`Failed to watch repositories: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

