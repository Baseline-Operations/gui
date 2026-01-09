import nodePlugin from "./node.js";
import pythonPlugin from "./python.js";
import goPlugin from "./go.js";
import rustPlugin from "./rust.js";
import javaPlugin from "./java.js";
import { LanguagePlugin } from "../types.js";

/**
 * All built-in language plugins.
 */
export const builtInLanguagePlugins: LanguagePlugin[] = [
	nodePlugin,
	pythonPlugin,
	goPlugin,
	rustPlugin,
	javaPlugin,
];

/**
 * Register all built-in language plugins with the plugin manager.
 */
export function registerBuiltInLanguagePlugins(
	pluginManager: import("../manager.js").PluginManager
): void {
	for (const plugin of builtInLanguagePlugins) {
		pluginManager.registerPlugin(plugin);
	}
}

