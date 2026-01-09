/**
 * CLI wrapper for status command
 */
import { getRepositoryStatus } from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";
import chalk from "chalk";

export async function statusCommand(): Promise<void> {
	try {
		const result = await getRepositoryStatus();

		if (!result.success) {
			Logger.error(result.messages[0]?.message || "Failed to get repository status");
			process.exit(1);
			return;
		}

		// Log title
		if (result.messages.length > 0 && result.messages[0].message === "Repository Status") {
			Logger.title("Repository Status");
		}

		// Log each repo status
		for (const repo of result.repos) {
			if (repo.notCloned) {
				Logger.log(
					chalk.gray(`${repo.name}: ${chalk.red("not cloned")}`)
				);
			} else if (repo.error) {
				Logger.error(`${repo.name}: ${repo.error}`);
			} else {
				const branchColor = repo.isDirty ? chalk.yellow : chalk.green;
				const branchIndicator = repo.isDirty ? "*" : "";

				let statusLine = `${repo.name}: ${branchColor(repo.branch)}${branchIndicator}`;

				if (repo.ahead > 0) {
					statusLine += chalk.blue(` +${repo.ahead}`);
				}
				if (repo.behind > 0) {
					statusLine += chalk.red(` -${repo.behind}`);
				}

				if (repo.isDirty) {
					statusLine += chalk.yellow(" (dirty)");
				}

				Logger.log(statusLine);
			}
		}

		// Log any additional error messages
		for (const msg of result.messages) {
			if (msg.type === "error" && msg.message !== "Repository Status") {
				Logger.error(msg.message);
			}
		}
	} catch (error) {
		Logger.error(
			`Failed to get repository status: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

