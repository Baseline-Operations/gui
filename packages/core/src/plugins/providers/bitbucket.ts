import { ProviderPlugin } from "../types.js";
import { execa } from "execa";

/**
 * Built-in Bitbucket provider plugin.
 * Provides Bitbucket integration for PR creation and repository management.
 */
const bitbucketPlugin: ProviderPlugin = {
	metadata: {
		id: "bitbucket",
		name: "Bitbucket",
		version: "1.0.0",
		description: "Bitbucket provider for PR creation and repository management",
		type: "provider",
		baselineVersion: "0.1.0",
	},

	matchesUrl(url: string): boolean {
		return /^(https?:\/\/)?(www\.)?bitbucket\.org\/[\w.-]+\/[\w.-]+(\.git)?$/.test(
			url
		);
	},

	getRepoUrlPattern(): string {
		return "bitbucket.org/**";
	},

	getGitUrl(repo: { owner: string; name: string; branch?: string }): string {
		return `https://bitbucket.org/${repo.owner}/${repo.name}.git`;
	},

	async createPullRequest(options: {
		repoPath: string;
		title: string;
		body?: string;
		base: string;
		head: string;
		draft?: boolean;
	}): Promise<string> {
		// Bitbucket doesn't have a standard CLI, so we'll use git and API
		// For now, return instructions or use bb CLI if available
		try {
			await execa("bb", ["version"], { timeout: 5000 });
			
			// Use bb CLI if available
			const args = [
				"pr",
				"create",
				"--title",
				options.title,
				"--target",
				options.base,
				"--source",
				options.head,
			];

			if (options.body) {
				args.push("--description", options.body);
			}

			try {
				const { stdout } = await execa("bb", args, {
					cwd: options.repoPath,
				});
				return stdout.trim();
			} catch (error) {
				throw new Error(
					`Failed to create PR: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		} catch {
			// bb CLI not available, provide instructions
			throw new Error(
				"Bitbucket CLI (bb) is not installed. Install it from https://github.com/cli/cli or create PR manually at: https://bitbucket.org"
			);
		}
	},
};

export default bitbucketPlugin;

