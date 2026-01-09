import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Gets the configured command name for the CLI.
 * Checks in order:
 * 1. BASELINE_COMMAND environment variable
 * 2. .baseline/command file (git-ignored)
 * 3. Default: "bl"
 *
 * @param workspaceRoot The workspace root directory. Defaults to current working directory.
 * @returns The command name to use.
 */
export function getCommandName(
	workspaceRoot: string = process.cwd()
): string {
	// Check environment variable first
	const envCommand = process.env.BASELINE_COMMAND;
	if (envCommand && envCommand.trim().length > 0) {
		return envCommand.trim();
	}

	// Check .baseline/command file
	const commandFilePath = join(workspaceRoot, ".baseline", "command");
	if (existsSync(commandFilePath)) {
		try {
			const command = readFileSync(commandFilePath, "utf-8").trim();
			if (command.length > 0) {
				return command;
			}
		} catch {
			// Failed to read file, continue to default
		}
	}

	// Default to "bl"
	return "bl";
}

/**
 * Creates the .baseline/command.example file with instructions.
 * @param workspaceRoot The workspace root directory.
 */
export async function createCommandExample(
	workspaceRoot: string = process.cwd()
): Promise<void> {
	const { mkdir, writeFile } = await import("fs/promises");
	const commandExamplePath = join(
		workspaceRoot,
		".baseline",
		"command.example"
	);
	const exampleContent = `# Baseline Command Name Configuration
#
# This file demonstrates how to configure the baseline command name.
# To use a custom command name:
#
# 1. Copy this file to 'command' (without .example):
#    cp .baseline/command.example .baseline/command
#
# 2. Edit .baseline/command and set your desired command name:
#    echo "mybaseline" > .baseline/command
#
# 3. The command name is automatically loaded when you run baseline commands.
#
# Alternatively, set the BASELINE_COMMAND environment variable:
#    export BASELINE_COMMAND=mybaseline
#
# Priority order:
# 1. BASELINE_COMMAND environment variable
# 2. .baseline/command file (git-ignored)
# 3. Default: "bl"
#
# Note: .baseline/command is git-ignored, so it won't be committed to your repository.
# Each developer can have their own command name preference.
`;

	try {
		const baselineDir = join(workspaceRoot, ".baseline");
		await mkdir(baselineDir, { recursive: true });
		await writeFile(commandExamplePath, exampleContent, "utf-8");
	} catch {
		// Failed to create, that's okay
	}
}
