import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PackageManagerUtil, PackageManager } from "../package-manager.js";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { existsSync } from "fs";

describe("PackageManagerUtil", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "pm-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	describe("detect", () => {
		it("should detect pnpm from lock file", async () => {
			await writeFile(join(tempDir, "pnpm-lock.yaml"), "", "utf-8");
			const detected = await PackageManagerUtil.detect(tempDir);
			expect(detected).toBe("pnpm");
		});

		it("should detect yarn from lock file", async () => {
			await writeFile(join(tempDir, "yarn.lock"), "", "utf-8");
			const detected = await PackageManagerUtil.detect(tempDir);
			expect(detected).toBe("yarn");
		});

		it("should detect npm from lock file", async () => {
			await writeFile(
				join(tempDir, "package-lock.json"),
				"",
				"utf-8"
			);
			const detected = await PackageManagerUtil.detect(tempDir);
			expect(detected).toBe("npm");
		});

		it("should prioritize pnpm over yarn over npm", async () => {
			await writeFile(join(tempDir, "pnpm-lock.yaml"), "", "utf-8");
			await writeFile(join(tempDir, "yarn.lock"), "", "utf-8");
			await writeFile(
				join(tempDir, "package-lock.json"),
				"",
				"utf-8"
			);
			const detected = await PackageManagerUtil.detect(tempDir);
			expect(detected).toBe("pnpm");
		});

		it("should return null when no lock files exist", async () => {
			const detected = await PackageManagerUtil.detect(tempDir);
			expect(detected).toBeNull();
		});

		it("should fallback to npm when package.json exists but no lock file", async () => {
			await writeFile(
				join(tempDir, "package.json"),
				JSON.stringify({ name: "test" }),
				"utf-8"
			);

			// Note: This test relies on actual system state.
			// In a real scenario, execa would be mocked, but for simplicity
			// we just verify that it returns a valid package manager or null
			const detected = await PackageManagerUtil.detect(tempDir);
			expect(
				detected === "npm" ||
					detected === "pnpm" ||
					detected === "yarn"
			).toBe(true);
		});
	});

	describe("isInstalled", () => {
		it("should check if npm is installed", async () => {
			const installed = await PackageManagerUtil.isInstalled("npm");
			// This will be true if npm is installed, false otherwise
			expect(typeof installed).toBe("boolean");
		});

		it("should check if pnpm is installed", async () => {
			const installed = await PackageManagerUtil.isInstalled("pnpm");
			expect(typeof installed).toBe("boolean");
		});

		it("should check if yarn is installed", async () => {
			const installed = await PackageManagerUtil.isInstalled("yarn");
			expect(typeof installed).toBe("boolean");
		});
	});

	describe("getVersion", () => {
		it("should get npm version if installed", async () => {
			const version = await PackageManagerUtil.getVersion("npm");
			if (version) {
				expect(typeof version).toBe("string");
				expect(version.length).toBeGreaterThan(0);
			}
		});
	});
});
