import { describe, it, expect } from "vitest";
import { VersionCheck } from "../version-check.js";
import { VersionPolicy } from "../../types/config.js";

describe("VersionCheck", () => {
	describe("satisfies", () => {
		it("should return valid when no policy is provided", () => {
			const result = VersionCheck.satisfies("1.0.0", undefined);
			expect(result.valid).toBe(true);
			expect(result.reason).toBeUndefined();
		});

		it("should validate exact version match (semver)", () => {
			const policy: VersionPolicy = { exact: "1.2.3" };
			expect(VersionCheck.satisfies("1.2.3", policy).valid).toBe(
				true
			);
			expect(VersionCheck.satisfies("1.2.4", policy).valid).toBe(
				false
			);
		});

		it("should validate minimum version (semver)", () => {
			const policy: VersionPolicy = { min: "1.2.0" };
			expect(VersionCheck.satisfies("1.2.0", policy).valid).toBe(
				true
			);
			expect(VersionCheck.satisfies("1.3.0", policy).valid).toBe(
				true
			);
			expect(VersionCheck.satisfies("1.1.9", policy).valid).toBe(
				false
			);
		});

		it("should validate maximum version (semver)", () => {
			const policy: VersionPolicy = { max: "2.0.0" };
			expect(VersionCheck.satisfies("1.9.9", policy).valid).toBe(
				true
			);
			expect(VersionCheck.satisfies("2.0.0", policy).valid).toBe(
				true
			);
			expect(VersionCheck.satisfies("2.0.1", policy).valid).toBe(
				false
			);
		});

		it("should validate version range (min and max)", () => {
			const policy: VersionPolicy = { min: "1.0.0", max: "2.0.0" };
			expect(VersionCheck.satisfies("1.5.0", policy).valid).toBe(
				true
			);
			expect(VersionCheck.satisfies("0.9.0", policy).valid).toBe(
				false
			);
			expect(VersionCheck.satisfies("2.1.0", policy).valid).toBe(
				false
			);
		});

		it("should validate exact version match (non-semver)", () => {
			const policy: VersionPolicy = { exact: "1.0" };
			expect(VersionCheck.satisfies("1.0", policy).valid).toBe(true);
			expect(VersionCheck.satisfies("1.1", policy).valid).toBe(
				false
			);
		});

		it("should validate minimum version (non-semver string comparison)", () => {
			const policy: VersionPolicy = { min: "1.0" };
			expect(VersionCheck.satisfies("1.0", policy).valid).toBe(true);
			expect(VersionCheck.satisfies("2.0", policy).valid).toBe(true);
			expect(VersionCheck.satisfies("0.9", policy).valid).toBe(
				false
			);
		});

		it("should validate maximum version (non-semver string comparison)", () => {
			const policy: VersionPolicy = { max: "2.0" };
			expect(VersionCheck.satisfies("1.9", policy).valid).toBe(true);
			expect(VersionCheck.satisfies("2.0", policy).valid).toBe(true);
			expect(VersionCheck.satisfies("2.1", policy).valid).toBe(
				false
			);
		});

		it("should provide reason when validation fails", () => {
			const policy: VersionPolicy = { exact: "1.0.0" };
			const result = VersionCheck.satisfies("2.0.0", policy);
			expect(result.valid).toBe(false);
			expect(result.reason).toContain("Expected exact version");
		});

		it("should handle prerelease versions", () => {
			const policy: VersionPolicy = { min: "1.0.0" };
			expect(
				VersionCheck.satisfies("1.0.0-alpha", policy).valid
			).toBe(true);
			expect(VersionCheck.satisfies("0.9.0", policy).valid).toBe(
				false
			);
		});
	});
});
