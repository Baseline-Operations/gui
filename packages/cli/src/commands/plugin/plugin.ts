/**
 * CLI wrapper for plugin commands
 */
import {
	installPlugin,
	listPlugins,
	removePlugin,
	installAllPlugins,
	searchPlugins,
	PluginInstallOptions,
} from "@baseline/core/commands";
import { Logger } from "@baseline/core/utils";

export async function pluginInstallCommand(
	pluginId: string,
	options: PluginInstallOptions = {}
): Promise<void> {
	try {
		const result = await installPlugin(pluginId, options);

		if (!result.success && result.messages.length === 1 && result.messages[0].type === "error") {
			Logger.error(result.messages[0].message);
			process.exit(1);
			return;
		}

		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Installing Plugin:")) {
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
			`Failed to install plugin: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

export async function pluginListCommand(
	options: { workspaceRoot?: string } = {}
): Promise<void> {
	try {
		const result = await listPlugins(options);

		if (!result.success && result.messages.length === 1 && result.messages[0].type === "error") {
			Logger.error(result.messages[0].message);
			process.exit(1);
			return;
		}

		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message === "Installed Plugins") {
					Logger.title(msg.message);
				} else if (msg.message === "") {
					Logger.log("");
				} else {
					Logger.info(msg.message);
				}
			} else if (msg.type === "dim") {
				Logger.dim(msg.message);
			} else if (msg.type === "success") {
				Logger.success(msg.message);
			} else if (msg.type === "error") {
				Logger.error(msg.message);
			}
		}
	} catch (error) {
		Logger.error(
			`Failed to list plugins: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

export async function pluginRemoveCommand(
	pluginId: string,
	options: { removeFromConfig?: boolean; workspaceRoot?: string } = {}
): Promise<void> {
	try {
		const result = await removePlugin(pluginId, options);

		if (!result.success && result.messages.length === 1 && result.messages[0].type === "error") {
			Logger.error(result.messages[0].message);
			process.exit(1);
			return;
		}

		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Removing Plugin:")) {
					Logger.title(msg.message);
				} else {
					Logger.info(msg.message);
				}
			} else if (msg.type === "success") {
				Logger.success(msg.message);
			} else if (msg.type === "error") {
				Logger.error(msg.message);
			}
		}

		if (!result.success) {
			process.exit(1);
		}
	} catch (error) {
		Logger.error(
			`Failed to remove plugin: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

export async function pluginInstallAllCommand(
	options: { workspaceRoot?: string } = {}
): Promise<void> {
	try {
		const result = await installAllPlugins(options);

		if (!result.success && result.messages.length === 1 && result.messages[0].type === "error") {
			Logger.error(result.messages[0].message);
			process.exit(1);
			return;
		}

		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Installing All Plugin Dependencies")) {
					Logger.title(msg.message);
				} else {
					Logger.info(msg.message);
				}
			} else if (msg.type === "success") {
				Logger.success(msg.message);
			} else if (msg.type === "error") {
				Logger.error(msg.message);
			}
		}

		if (!result.success) {
			process.exit(1);
		}
	} catch (error) {
		Logger.error(
			`Failed to install all plugins: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

export async function pluginSearchCommand(
	query: string,
	options: { registry?: boolean; workspaceRoot?: string } = {}
): Promise<void> {
	try {
		const result = await searchPlugins(query, options);

		if (!result.success && result.messages.length === 1 && result.messages[0].type === "error") {
			Logger.error(result.messages[0].message);
			process.exit(1);
			return;
		}

		for (const msg of result.messages) {
			if (msg.type === "info") {
				if (msg.message.includes("Searching for plugins:")) {
					Logger.title(msg.message);
				} else if (msg.message === "") {
					Logger.log("");
				} else {
					Logger.info(msg.message);
				}
			} else if (msg.type === "dim") {
				Logger.dim(msg.message);
			} else if (msg.type === "error") {
				Logger.error(msg.message);
			}
		}
	} catch (error) {
		Logger.error(
			`Failed to search plugins: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}
}

