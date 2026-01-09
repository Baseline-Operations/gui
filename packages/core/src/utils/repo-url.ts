import { NormalizedRepo } from "../types/config.js";
import { PluginManager } from "../plugins/manager.js";
import { ProviderPlugin } from "../plugins/types.js";

/**
 * Get the git URL for a repository.
 * Handles gitUrl (direct), repository (provider-based), or local (returns null).
 */
export async function getRepoGitUrl(repo: NormalizedRepo): Promise<string | null> {
	// Direct git URL
	if (repo.gitUrl) {
		return repo.gitUrl;
	}

	// Provider-based repository
	if (repo.repository) {
		const pluginManager = PluginManager.getInstance();
		await pluginManager.initialize();

		const providerPlugin = pluginManager.getPlugin(
			repo.repository.provider
		) as ProviderPlugin | undefined;

		if (providerPlugin && providerPlugin.getGitUrl) {
			return providerPlugin.getGitUrl({
				owner: repo.repository.owner,
				name: repo.repository.name,
				branch: repo.repository.branch || repo.defaultBranch,
			});
		}

		// Fallback: construct URL from provider
		const { provider, owner, name } = repo.repository;
		if (provider === "github") {
			return `https://github.com/${owner}/${name}.git`;
		} else if (provider === "gitlab") {
			return `https://gitlab.com/${owner}/${name}.git`;
		} else if (provider === "bitbucket") {
			return `https://bitbucket.org/${owner}/${name}.git`;
		}
	}

	// Local repository (no git URL)
	return null;
}

