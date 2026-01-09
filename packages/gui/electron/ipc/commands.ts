import { ipcMain } from "electron";
import { execa } from "execa";

/**
 * IPC handlers for command execution
 * These handlers call the core baseline functions via CLI
 */
ipcMain.handle("command:execute", async (_event, request) => {
	try {
		const { command, args = [], options = {}, workspaceRoot } = request;

		// Execute baseline CLI command
		const result = await execa("baseline", [command, ...args], {
			cwd: workspaceRoot || process.cwd(),
			...options,
		});

		return {
			success: true,
			output: result.stdout,
			exitCode: result.exitCode,
		};
	} catch (error: any) {
		return {
			success: false,
			error: error.message || String(error),
			exitCode: error.exitCode || 1,
			output: error.stdout || "",
		};
	}
});

// Stream command output in real-time
ipcMain.on("command:stream", async (_event, request) => {
	const { command, args = [], options = {}, workspaceRoot } = request;
	
	const childProcess = execa("baseline", [command, ...args], {
		cwd: workspaceRoot || process.cwd(),
		...options,
	});

	if (childProcess.stdout) {
		childProcess.stdout.on("data", (data) => {
			_event.sender.send("command:output", data.toString());
		});
	}

	if (childProcess.stderr) {
		childProcess.stderr.on("data", (data) => {
			_event.sender.send("command:output", data.toString());
		});
	}

	childProcess.on("close", (code) => {
		_event.sender.send("command:complete", code);
	});
});

