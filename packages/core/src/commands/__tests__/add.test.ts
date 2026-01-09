import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { addCommand } from "../workspace/add.js";
import { ConfigManager } from "../../config/manager.js";
import { BaselineConfig } from "../../types/config.js";

describe("addCommand", () => {
	let tempDir: string;
	let configManager: ConfigManager;
	let originalCwd: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "baseline-add-test-"));
		configManager = new ConfigManager(tempDir);
		originalCwd = process.cwd();

		// Create initial config
		const initialConfig: BaselineConfig = {
			name: "test-workspace",
			version: "0.1.0",
			private: true,
			repos: [],
			languages: {},
			packageManagers: {
				supported: ["npm"],
				default: "npm",
			},
		};

		await configManager.save(initialConfig);
		process.chdir(tempDir);
	});

	afterEach(async () => {
		process.chdir(originalCwd);
		await rm(tempDir, { recursive: true, force: true });
	});

	it("should add repository to config", async () => {
		const gitUrl = "https://github.com/owner/repo.git";

		// Mock process.exit to prevent actual exit
		const originalExit = process.exit;
		const exitMock = vi.fn() as any;
		process.exit = exitMock;

		try {
			await addCommand(gitUrl, { name: "test-repo" });

			const config = await configManager.load();
			expect(config).not.toBeNull();
			expect(config?.repos).toHaveLength(1);
			expect(config?.repos[0].name).toBe("test-repo");
			expect(config?.repos[0].gitUrl).toBe(gitUrl);
		} finally {
			process.exit = originalExit;
		}
	});

	it("should extract repo name from URL if not provided", async () => {
		const gitUrl = "https://github.com/owner/my-repo.git";

		const originalExit = process.exit;
		process.exit = vi.fn() as any;

		try {
			await addCommand(gitUrl);

			const config = await configManager.load();
			expect(config?.repos[0].name).toBe("my-repo");
		} finally {
			process.exit = originalExit;
		}
	});

	it("should use custom path when provided", async () => {
		const gitUrl = "https://github.com/owner/repo.git";
		const customPath = "./custom/path";

		const originalExit = process.exit;
		process.exit = vi.fn() as any;

		try {
			await addCommand(gitUrl, { path: customPath });

			const config = await configManager.load();
			expect(config?.repos[0].path).toBe(customPath);
		} finally {
			process.exit = originalExit;
		}
	});

	it("should add tags when provided", async () => {
		const gitUrl = "https://github.com/owner/repo.git";
		const tags = ["app", "web"];

		const originalExit = process.exit;
		process.exit = vi.fn() as any;

		try {
			await addCommand(gitUrl, { tags });

			const config = await configManager.load();
			expect(config?.repos[0].tags).toEqual(tags);
		} finally {
			process.exit = originalExit;
		}
	});

	it("should add languages when provided", async () => {
		const gitUrl = "https://github.com/owner/repo.git";
		const languages = ["node", "typescript"];

		const originalExit = process.exit;
		process.exit = vi.fn() as any;

		try {
			await addCommand(gitUrl, { languages });

			const config = await configManager.load();
			expect(config?.repos[0].languages).toEqual(languages);
		} finally {
			process.exit = originalExit;
		}
	});

	it("should set package manager override when provided", async () => {
		const gitUrl = "https://github.com/owner/repo.git";

		const originalExit = process.exit;
		process.exit = vi.fn() as any;

		try {
			await addCommand(gitUrl, { packageManager: "pnpm" });

			const config = await configManager.load();
			expect(config?.repos[0].packageManager).toBe("pnpm");
		} finally {
			process.exit = originalExit;
		}
	});
});
