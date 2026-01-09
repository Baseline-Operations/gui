import { Package, NormalizedPackage, LanguagesConfig, VersionPolicy, BaselineConfig } from "../types/config.js";
import { basename } from "path";

/**
 * Normalize a package (string or object) to always be an object.
 * Supports both new structure (id, location, version) and legacy structure.
 */
export function normalizePackage(pkg: Package, _workspaceRoot?: string): NormalizedPackage {
	if (typeof pkg === "string") {
		// String package: just path, auto-detect everything else
		const path = pkg;
		const id = basename(path);
		return {
			id,
			name: id,
			path,
			defaultBranch: "main",
			library: false,
			startInDocker: false,
		};
	}

	// Object package: fill in defaults
	// Handle new structure: id, location, version
	const id = pkg.id || pkg.name || (pkg.path ? basename(pkg.path) : "unknown-package");
	const name = pkg.name || id;
	const location = pkg.location || pkg.gitUrl;
	const path = pkg.path || (id ? `packages/${id}` : "packages/unknown-package");
	
	const normalized: NormalizedPackage = {
		id,
		name,
		path,
		location: location || undefined,
		gitUrl: location || undefined, // Legacy alias
		version: pkg.version,
		repository: (pkg as any).repository, // Access repository from legacy structure
		defaultBranch: pkg.defaultBranch || "main",
		tags: pkg.tags,
		languages: pkg.languages,
		packageManager: pkg.packageManager,
		library: pkg.library ?? false,
		commands: pkg.commands,
		startInDocker: pkg.startInDocker ?? false,
		dockerImage: pkg.dockerImage,
		watch: pkg.watch,
		requiredPlugins: pkg.requiredPlugins,
	};
	return normalized;
}

/**
 * Legacy alias for backward compatibility.
 * @deprecated Use normalizePackage instead
 */
export function normalizeRepo(repo: Package, workspaceRoot?: string): NormalizedPackage {
	return normalizePackage(repo, workspaceRoot);
}

/**
 * Parse version string to VersionPolicy object.
 * Supports: ">=20.0.0", "<=5.0.0", "^1.0.0", "~2.0.0", "5.0.0" (exact)
 */
export function parseVersionPolicy(version: string): VersionPolicy {
	if (version.startsWith(">=")) {
		return { min: version.slice(2) };
	} else if (version.startsWith("<=")) {
		return { max: version.slice(2) };
	} else if (version.startsWith("^") || version.startsWith("~")) {
		// For ^ and ~, we'll treat as min version
		return { min: version.slice(1) };
	} else {
		// Exact version
		return { exact: version };
	}
}

/**
 * Convert simplified languages config to version policies map.
 */
export function languagesConfigToVersionPolicies(
	languages: LanguagesConfig
): Record<string, VersionPolicy> {
	if (!languages) return {};
	
	const policies: Record<string, VersionPolicy> = {};
	for (const [tool, version] of Object.entries(languages)) {
		policies[tool] = parseVersionPolicy(version);
	}
	return policies;
}

/**
 * Normalize all packages in a config (convert strings to objects).
 */
export function normalizeAllPackages(packages: Package[], workspaceRoot?: string): NormalizedPackage[] {
	return packages.map(pkg => normalizePackage(pkg, workspaceRoot));
}

/**
 * Get packages from config with backward compatibility for repos.
 */
export function getPackagesFromConfig(config: BaselineConfig): Package[] {
	return config.packages || config.repos || [];
}

/**
 * Normalize all packages from a config.
 */
export function normalizeAllPackagesFromConfig(config: BaselineConfig, workspaceRoot?: string): NormalizedPackage[] {
	const packages = getPackagesFromConfig(config);
	return normalizeAllPackages(packages, workspaceRoot);
}

/**
 * Legacy alias for backward compatibility.
 * @deprecated Use normalizeAllPackages instead
 */
export function normalizeAllRepos(repos: Package[], workspaceRoot?: string): NormalizedPackage[] {
	return normalizeAllPackages(repos, workspaceRoot);
}

