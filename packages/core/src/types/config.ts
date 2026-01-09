import { z } from "zod";

export const VersionPolicySchema = z.object({
	min: z.string().optional(),
	max: z.string().optional(),
	exact: z.string().optional(),
});

// Simplified: languages config is just version policies map
// Format: { "node": ">=20.0.0", "typescript": ">=5.0.0" }
// Version string can be semver range (>=, <=, ^, ~) or exact version
export const LanguagesConfigSchema = z.record(z.string(), z.string()).optional();

export const RepoCommandsSchema = z.object({
	test: z.string().optional(),
	lint: z.string().optional(),
	start: z.string().optional(),
});

export const WatchConfigSchema = z.object({
	patterns: z.array(z.string()).optional(),
	ignore: z.array(z.string()).optional(),
	customCommand: z.string().optional(),
});

// Package can be a string (just path) or an object
// String: "packages/core" - local package, auto-detect id, languages, etc.
// Object: package config with id, location (repo URL), and optional version
export const PackageSchema = z.union([
	z.string(), // Simple path string for local packages
	z.object({
		id: z.string().optional(), // Package identifier/name (auto-detect if not provided)
		location: z.string().optional(), // Repository location (git URL or local path)
		version: z.string().optional(), // Optional version/branch/tag
		// Legacy/optional fields for backward compatibility
		name: z.string().optional(), // Alias for id
		gitUrl: z.string().optional(), // Alias for location
		path: z.string().optional(), // Local path (auto-detect from id if not provided)
		repository: z.object({
			provider: z.string(),
			owner: z.string(),
			name: z.string(),
			branch: z.string().optional(),
		}).optional(),
		defaultBranch: z.string().optional(),
		tags: z.array(z.string()).optional(),
		languages: z.array(z.string()).optional(),
		packageManager: z.string().optional(),
		library: z.boolean().optional().default(false),
		commands: RepoCommandsSchema.optional(),
		startInDocker: z.boolean().optional().default(false),
		dockerImage: z.string().optional(),
		watch: WatchConfigSchema.optional(),
		requiredPlugins: z.array(z.string()).optional(),
	}),
]);

// Simplified: just a string, auto-detect if not specified
export const PackageManagerConfigSchema = z.string().optional();

export const GitHubConfigSchema = z.object({
	provider: z.literal("github").default("github"),
	useGhCli: z.boolean().default(true),
	owner: z.string().optional(),
	repoVisibility: z.enum(["public", "private", "internal"]).optional(),
	defaultBaseBranch: z.string().default("main"),
});

// Simplified: string or array of editor names
export const EditorConfigSchema = z.union([
	z.string(), // Single editor: "vscode"
	z.array(z.string()), // Multiple editors: ["vscode", "cursor"]
]);

export const PluginDependencySchema = z.object({
	version: z.string().optional(),
	source: z.enum(["npm", "git", "local", "remote"]).optional(),
	url: z.string().optional(), // For git, remote, or npm package name
	path: z.string().optional(), // For local plugins
});

export const ProjectConfigSchema = z.object({
	name: z.string().optional(),
	library: z.boolean().optional(),
	commands: RepoCommandsSchema.optional(),
	watch: WatchConfigSchema.optional(),
	startInDocker: z.boolean().optional(),
	dockerImage: z.string().optional(),
	requiredPlugins: z
		.record(z.string(), PluginDependencySchema)
		.optional(),
});

export const PluginConfigSchema = z.object({
	enabled: z.array(z.string()).optional(),
	config: z.record(z.string(), z.any()).optional(),
	dependencies: z.record(z.string(), PluginDependencySchema).optional(),
});

export const BaselineConfigSchema = z.object({
	name: z.string().optional(), // Not used, kept for compatibility
	version: z.string().optional(), // Not used, kept for compatibility
	private: z.boolean().optional().default(true), // Not used, kept for compatibility
	packages: z.array(PackageSchema),
	repos: z.array(PackageSchema).optional(), // Legacy alias for packages
	languages: LanguagesConfigSchema, // Simplified: just version policies map
	packageManager: PackageManagerConfigSchema, // Simplified: just string
	github: GitHubConfigSchema.optional(),
	editor: EditorConfigSchema.optional(),
	plugins: PluginConfigSchema.optional(),
});

export type VersionPolicy = z.infer<typeof VersionPolicySchema>;
export type LanguagesConfig = z.infer<typeof LanguagesConfigSchema>;
export type RepoCommands = z.infer<typeof RepoCommandsSchema>;
export type WatchConfig = z.infer<typeof WatchConfigSchema>;
export type Package = z.infer<typeof PackageSchema>;
export type Repo = Package; // Legacy alias
export type PackageManagerConfig = z.infer<typeof PackageManagerConfigSchema>;
export type GitHubConfig = z.infer<typeof GitHubConfigSchema>;
export type EditorConfig = z.infer<typeof EditorConfigSchema>;
export type PluginDependency = z.infer<typeof PluginDependencySchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type BaselineConfig = z.infer<typeof BaselineConfigSchema>;

// Helper type for normalized package (always an object)
export interface NormalizedPackage {
	id: string;
	name: string; // Alias for id
	location?: string; // Repository location (git URL or path)
	gitUrl?: string; // Legacy alias for location
	version?: string; // Version/branch/tag
	repository?: {
		provider: string;
		owner: string;
		name: string;
		branch?: string;
	};
	defaultBranch: string;
	path: string;
	tags?: string[];
	languages?: string[];
	packageManager?: string;
	library: boolean;
	commands?: RepoCommands;
	startInDocker: boolean;
	dockerImage?: string;
	watch?: WatchConfig;
	requiredPlugins?: string[];
}

// Legacy alias for backward compatibility
export type NormalizedRepo = NormalizedPackage;
