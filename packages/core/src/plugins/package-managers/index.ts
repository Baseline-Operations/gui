import npmPlugin from "./npm.js";
import pnpmPlugin from "./pnpm.js";
import yarnPlugin from "./yarn.js";
import pipPlugin from "./pip.js";
import cargoPlugin from "./cargo.js";
import mavenPlugin from "./maven.js";
import gradlePlugin from "./gradle.js";
import { PackageManagerPlugin } from "../types.js";

/**
 * All built-in package manager plugins.
 */
export const builtInPackageManagerPlugins: PackageManagerPlugin[] = [
	npmPlugin,
	pnpmPlugin,
	yarnPlugin,
	pipPlugin,
	cargoPlugin,
	mavenPlugin,
	gradlePlugin,
];

/**
 * Register all built-in package manager plugins with the plugin manager.
 */
export function registerBuiltInPackageManagerPlugins(
	pluginManager: import("../manager.js").PluginManager
): void {
	for (const plugin of builtInPackageManagerPlugins) {
		pluginManager.registerPlugin(plugin);
	}
}

