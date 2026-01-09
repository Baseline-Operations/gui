import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";
import { RetryUtil } from "./retry.js";

export interface GitStatus {
	branch: string;
	isDirty: boolean;
	ahead: number;
	behind: number;
	hasUncommittedChanges: boolean;
}

export class GitUtil {
	static async isRepo(path: string): Promise<boolean> {
		return existsSync(join(path, ".git"));
	}

	static async getStatus(repoPath: string): Promise<GitStatus> {
		try {
			const [branchResult, statusResult, revListResult] =
				await Promise.all([
					execa("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
						cwd: repoPath,
					}),
					execa("git", ["status", "--porcelain"], {
						cwd: repoPath,
					}),
					execa(
						"git",
						[
							"rev-list",
							"--left-right",
							"--count",
							"HEAD...@{upstream}",
						],
						{ cwd: repoPath }
					).catch(() => ({ stdout: "0\t0" })),
				]);

			const branch = branchResult.stdout.trim();
			const isDirty = statusResult.stdout.trim().length > 0;
			const [behind, ahead] = revListResult.stdout
				.trim()
				.split("\t")
				.map(Number);

			return {
				branch,
				isDirty,
				ahead: ahead || 0,
				behind: behind || 0,
				hasUncommittedChanges: isDirty,
			};
		} catch (error) {
			throw new Error(
				`Failed to get git status for ${repoPath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	static async getRemoteName(repoPath: string): Promise<string> {
		try {
			// Try to get the default remote (usually "origin")
			const { stdout } = await execa(
				"git",
				["remote"],
				{ cwd: repoPath }
			);
			const remotes = stdout.trim().split("\n").filter(Boolean);
			// Return "origin" if it exists, otherwise the first remote
			return remotes.includes("origin") ? "origin" : remotes[0] || "origin";
		} catch {
			// Default to "origin" if we can't detect remotes
			return "origin";
		}
	}

	static async clone(
		gitUrl: string,
		targetPath: string,
		retry: boolean = true
	): Promise<void> {
		const operation = async () => {
			await execa("git", ["clone", gitUrl, targetPath], {
				stdio: "inherit",
			});
		};

		if (retry) {
			await RetryUtil.retryOnRetryable(operation, {
				maxAttempts: 3,
				delayMs: 2000,
				backoff: true,
				onRetry: (_attempt, _error) => {
					// Retry logic is handled by RetryUtil
				},
			});
		} else {
			await operation();
		}
	}

	static async fetch(
		repoPath: string,
		retry: boolean = true
	): Promise<void> {
		const operation = async () => {
			await execa("git", ["fetch"], {
				cwd: repoPath,
				stdio: "inherit",
			});
		};

		if (retry) {
			await RetryUtil.retryOnRetryable(operation, {
				maxAttempts: 3,
				delayMs: 2000,
				backoff: true,
			});
		} else {
			await operation();
		}
	}

	static async pull(
		repoPath: string,
		branch?: string,
		retry: boolean = true
	): Promise<void> {
		const operation = async () => {
			const args = ["pull"];
			if (branch) {
				const remote = await this.getRemoteName(repoPath);
				args.push(remote, branch);
			}
			await execa("git", args, {
				cwd: repoPath,
				stdio: "inherit",
			});
		};

		if (retry) {
			await RetryUtil.retryOnRetryable(operation, {
				maxAttempts: 3,
				delayMs: 2000,
				backoff: true,
			});
		} else {
			await operation();
		}
	}

	static async checkoutBranch(
		repoPath: string,
		branch: string,
		create: boolean = false
	): Promise<void> {
		try {
			const args =
				create ? ["checkout", "-b", branch] : ["checkout", branch];
			await execa("git", args, {
				cwd: repoPath,
				stdio: "inherit",
			});
		} catch (error) {
			throw new Error(
				`Failed to checkout branch ${branch} in ${repoPath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
}
