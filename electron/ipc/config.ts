import { ipcMain } from "electron";
import { ConfigManager } from "@baseline/core/config/manager.js";

/**
 * IPC handlers for config management
 */
ipcMain.handle("config:load", async (_event) => {
	try {
		const configManager = new ConfigManager();
		const config = await configManager.load();
		return {
			success: true,
			config,
			workspaceRoot: configManager.getWorkspaceRoot(),
		};
	} catch (error: any) {
		return {
			success: false,
			error: error.message || String(error),
		};
	}
});

ipcMain.handle("config:save", async (_event, config) => {
	try {
		const configManager = new ConfigManager();
		await configManager.save(config);
		return {
			success: true,
		};
	} catch (error: any) {
		return {
			success: false,
			error: error.message || String(error),
		};
	}
});

