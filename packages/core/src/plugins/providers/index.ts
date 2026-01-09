import githubPlugin from "./github.js";
import gitlabPlugin from "./gitlab.js";
import bitbucketPlugin from "./bitbucket.js";
import { ProviderPlugin } from "../types.js";

/**
 * All built-in provider plugins.
 */
export const builtInProviderPlugins: ProviderPlugin[] = [
	githubPlugin,
	gitlabPlugin,
	bitbucketPlugin,
];

/**
 * Register all built-in provider plugins with the plugin manager.
 */
export function registerBuiltInProviderPlugins(
	pluginManager: import("../manager.js").PluginManager
): void {
	for (const plugin of builtInProviderPlugins) {
		pluginManager.registerPlugin(plugin);
	}
}

