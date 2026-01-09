import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigManager } from "../manager.js";
import { BaselineConfig } from "../../types/config.js";

describe("ConfigManager", () => {
	let tempDir: string;
	let manager: ConfigManager;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "baseline-test-"));
		manager = new ConfigManager(tempDir);
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("should return null when config file does not exist", async () => {
		const config = await manager.load();
		expect(config).toBeNull();
	});

	it("should return false when config does not exist", () => {
		expect(manager.exists()).toBe(false);
	});

	it("should save and load config", async () => {
		const testConfig: BaselineConfig = {
			name: "test-workspace",
			version: "0.1.0",
			private: true,
			repos: [],
			languages: {},
			packageManagers: {
				supported: ["npm", "pnpm"],
				default: "npm",
			},
		};

		await manager.save(testConfig);
		expect(manager.exists()).toBe(true);

		const loaded = await manager.load();
		expect(loaded).toEqual(testConfig);
	});

	it("should get workspace root", () => {
		expect(manager.getWorkspaceRoot()).toBe(tempDir);
	});

	it("should get config path", () => {
		const configPath = manager.getConfigPath();
		expect(configPath).toBe(join(tempDir, "baseline.json"));
	});

	it("should throw error when loading invalid config", async () => {
		await writeFile(
			manager.getConfigPath(),
			JSON.stringify({ invalid: "config" }),
			"utf-8"
		);

		await expect(manager.load()).rejects.toThrow();
	});

	it("should throw error when loading malformed JSON", async () => {
		await writeFile(manager.getConfigPath(), "invalid json", "utf-8");

		await expect(manager.load()).rejects.toThrow();
	});

	describe("findWorkspaceRoot", () => {
		it("should find workspace root from subdirectory", async () => {
			const config: BaselineConfig = {
				name: "test",
				version: "0.1.0",
				private: true,
				repos: [],
				languages: {},
				packageManagers: {
					supported: ["npm"],
					default: "npm",
				},
			};

			await manager.save(config);

			const subDir = join(tempDir, "sub", "dir");
			await mkdir(subDir, { recursive: true });

			const found = ConfigManager.findWorkspaceRoot(subDir);
			expect(found).toBe(tempDir);
		});

		it("should return null when workspace root not found", () => {
			const found = ConfigManager.findWorkspaceRoot(tempDir);
			expect(found).toBeNull();
		});
	});
});
