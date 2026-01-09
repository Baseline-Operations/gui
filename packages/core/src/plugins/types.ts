// Import VersionPolicy from config types (re-export for plugin use)
import type { VersionPolicy } from "../types/config.js";
export type { VersionPolicy };

/**
 * Toolchain tool definition.
 * Used by language plugins to describe required tools.
 */
export interface ToolchainTool {
	name: string;
	versionPolicy?: VersionPolicy;
}

/**
 * Language profile returned by language plugins.
 * This is an internal type used by plugins, not the config structure.
 */
export interface LanguageProfile {
	displayName: string;
	toolchain: ToolchainTool[];
	projectMarkers: string[];
}

/**
 * Plugin dependency requirements (for plugin metadata).
 * Note: This is different from PluginDependency in types/config.ts which is for baseline.json config.
 */
export interface PluginRequirement {
	/** Plugin ID that this plugin requires */
	pluginId: string;
	/** Optional version constraint (semver) */
	version?: string;
}

/**
 * Plugin metadata information.
 */
export interface PluginMetadata {
	/** Unique plugin identifier */
	id: string;
	/** Plugin display name */
	name: string;
	/** Plugin version */
	version: string;
	/** Plugin description */
	description?: string;
	/** Plugin author */
	author?: string;
	/** Plugin type */
	type: "language" | "provider" | "package-manager" | "editor" | "other";
	/** Minimum baseline version required (semver) */
	baselineVersion?: string;
	/** Plugin dependencies */
	requires?: PluginRequirement[];
	/** Language IDs this plugin requires (for package-manager and editor plugins) */
	requiresLanguages?: string[];
}

/**
 * Command discovery result from language plugin.
 */
export interface CommandDiscovery {
	test?: string;
	lint?: string;
	start?: string;
}

/**
 * Project file information.
 */
export interface ProjectFile {
	path: string;
	required: boolean;
	description?: string;
}

/**
 * Language plugin interface.
 * Plugins can provide language-specific functionality including:
 * - Toolchain definitions
 * - Project markers
 * - Version policies
 * - Custom commands
 * - Command discovery
 * - Project file detection
 */
export interface LanguagePlugin {
	/** Plugin metadata */
	metadata: PluginMetadata;
	/** Get language profile for this plugin */
	getLanguageProfile(options?: LanguagePluginOptions): LanguageProfile;
	/** Get interactive prompts for plugin configuration */
	getPrompts?(): Array<any>;
	/** Validate plugin-specific configuration */
	validate?(config: unknown): { valid: boolean; error?: string };
	/**
	 * Discover commands (test, lint, start) from project files.
	 * @param repoPath Path to the repository
	 * @returns Discovered commands or null if not applicable
	 */
	discoverCommands?(
		repoPath: string,
		options?: { packageManager?: string }
	): Promise<CommandDiscovery | null>;
	/**
	 * Get project files that should be checked (e.g., lockfiles, config files).
	 * @returns Array of project files to check
	 */
	getProjectFiles?(): ProjectFile[];
	/**
	 * Check if a repository is of this language type.
	 * @param repoPath Path to the repository
	 * @returns True if the repository matches this language
	 */
	detectLanguage?(repoPath: string): Promise<boolean>;
	/**
	 * Get detection command for a tool.
	 * @param toolName Name of the tool
	 * @returns Detection command info or null if not supported
	 */
	getDetectionCommand?(toolName: string): { command: string; args?: string[] } | null;
	/**
	 * Get the command runner for executing commands.
	 * For Node.js, this would be the package manager (npm, pnpm, yarn).
	 * For other languages, this might be the build tool or null to run commands directly.
	 * @param repoPath Path to the repository
	 * @param options Options including detected package manager for Node.js repos
	 * @returns Command runner configuration or null if commands should run directly
	 */
	getCommandRunner?(
		repoPath: string,
		options?: { packageManager?: string }
	): Promise<{ runner: string; args: string[] } | null>;
}

/**
 * Provider plugin interface (e.g., GitHub, GitLab, Bitbucket).
 * Handles Git hosting service integration.
 */
export interface ProviderPlugin {
	metadata: PluginMetadata;
	/**
	 * Create a pull request.
	 * @param options PR creation options
	 * @returns PR URL or identifier
	 */
	createPullRequest?(options: {
		repoPath: string;
		title: string;
		body?: string;
		base: string;
		head: string;
		draft?: boolean;
	}): Promise<string>;
	/**
	 * Get repository URL pattern for this provider.
	 * @returns URL pattern or regex for matching
	 */
	getRepoUrlPattern?(): string | RegExp;
	/**
	 * Check if a repository URL belongs to this provider.
	 * @param url Repository URL
	 * @returns True if URL matches this provider
	 */
	matchesUrl?(url: string): boolean;
	/**
	 * Get git URL from repository info.
	 * @param repo Repository info (owner, name, branch)
	 * @returns Git URL string
	 */
	getGitUrl?(repo: { owner: string; name: string; branch?: string }): string;
}

/**
 * Package manager plugin interface.
 * Provides package manager support for languages.
 */
export interface PackageManagerPlugin {
	metadata: PluginMetadata;
	/**
	 * Get workspace linking configuration for this package manager.
	 * @param repos List of repositories to link
	 * @param workspaceRoot Workspace root path
	 * @returns Workspace configuration object or null if no packages found
	 */
	createWorkspaceConfig?(
		repos: Array<{ path: string; name: string }>,
		workspaceRoot: string
	): Promise<{ file: string; content: string } | null>;
	/**
	 * Get install command for this package manager.
	 * @returns Command to run for installation
	 */
	getInstallCommand?(): string;
	/**
	 * Get run command prefix for executing scripts.
	 * @returns Command prefix (e.g., ["npm", "run"] or ["pnpm", "run"])
	 */
	getRunCommand?(): string[];
	/**
	 * Check if this package manager is installed.
	 * @returns True if package manager is available
	 */
	isInstalled?(): Promise<boolean>;
	/**
	 * Get version of this package manager.
	 * @returns Version string or null if not installed
	 */
	getVersion?(): Promise<string | null>;
}

/**
 * Editor plugin interface.
 * Provides editor/IDE workspace integration.
 */
export interface EditorPlugin {
	metadata: PluginMetadata;
	/**
	 * Generate workspace configuration file.
	 * @param config Baseline workspace configuration
	 * @param workspaceRoot Workspace root path
	 * @returns Workspace file configuration
	 */
	generateWorkspaceFile?(
		config: any,
		workspaceRoot: string
	): Promise<{ file: string; content: string }>;
}

/**
 * Options passed to language plugins when getting their profile.
 */
export interface LanguagePluginOptions {
	/** Default package manager for Node.js projects */
	packageManager?: "npm" | "pnpm" | "yarn";
	/** Version policy overrides */
	versionPolicies?: Record<string, VersionPolicy>;
	/** Custom toolchain additions */
	additionalTools?: Array<{
		name: string;
		versionPolicy?: VersionPolicy;
		detection: { command: string; args?: string[] };
	}>;
}

/**
 * Base plugin interface that all plugins must implement.
 */
export type BaselinePlugin =
	| LanguagePlugin
	| ProviderPlugin
	| PackageManagerPlugin
	| EditorPlugin;

/**
 * Plugin package definition.
 * Allows a single module to export multiple plugins.
 */
export interface PluginPackage {
	/** Package metadata */
	metadata: {
		name: string;
		version: string;
		description?: string;
		author?: string;
		baselineVersion?: string;
	};
	/** Plugins in this package */
	plugins: BaselinePlugin[];
	/** Package dependencies */
	dependencies?: PluginRequirement[];
	/** Required language IDs */
	requiresLanguages?: string[];
}

/**
 * Plugin loader function type.
 * Plugins can be loaded from files, npm packages, or remote URLs.
 */
export type PluginLoader = (
	path: string
) => Promise<BaselinePlugin | PluginPackage>;
