import { ProviderPlugin } from "../types.js";
import { execa } from "execa";

/**
 * Built-in GitHub provider plugin.
 * Provides GitHub integration for PR creation and repository management.
 */
const githubPlugin: ProviderPlugin = {
	metadata: {
		id: "github",
		name: "GitHub",
		version: "1.0.0",
		description: "GitHub provider for PR creation and repository management",
		type: "provider",
		baselineVersion: "0.1.0",
	},

	matchesUrl(url: string): boolean {
		return /^(https?:\/\/)?(www\.)?github\.com\/[\w.-]+\/[\w.-]+(\.git)?$/.test(
			url
		);
	},

	getRepoUrlPattern(): string {
		return "github.com/**";
	},

	getGitUrl(repo: { owner: string; name: string; branch?: string }): string {
		return `https://github.com/${repo.owner}/${repo.name}.git`;
	},

	async createPullRequest(options: {
		repoPath: string;
		title: string;
		body?: string;
		base: string;
		head: string;
		draft?: boolean;
	}): Promise<string> {
		// Check if gh CLI is available
		try {
			await execa("gh", ["--version"], { timeout: 5000 });
		} catch {
			throw new Error(
				"GitHub CLI (gh) is not installed. Install it from https://cli.github.com/"
			);
		}

		const args = [
			"pr",
			"create",
			"--title",
			options.title,
			"--base",
			options.base,
			"--head",
			options.head,
		];

		if (options.body) {
			args.push("--body", options.body);
		}

		if (options.draft) {
			args.push("--draft");
		}

		try {
			const { stdout } = await execa("gh", args, {
				cwd: options.repoPath,
			});
			return stdout.trim();
		} catch (error) {
			throw new Error(
				`Failed to create PR: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	},
};

export default githubPlugin;

