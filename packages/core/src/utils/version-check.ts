import semver from "semver";
import { VersionPolicy } from "../types/config.js";

/**
 * Utility class for validating version strings against version policies.
 * Supports both semantic versioning (semver) and string-based comparison.
 */
export class VersionCheck {
	/**
	 * Check if a version satisfies the given version policy.
	 *
	 * @param version - Version string to check (e.g., "1.2.3" or "1.0")
	 * @param policy - Version policy with min/max/exact constraints
	 * @returns Object with `valid` boolean and optional `reason` string
	 *
	 * @example
	 * ```ts
	 * // Check exact version
	 * VersionCheck.satisfies("1.2.3", { exact: "1.2.3" });
	 *
	 * // Check minimum version
	 * VersionCheck.satisfies("2.0.0", { min: "1.0.0" });
	 *
	 * // Check version range
	 * VersionCheck.satisfies("1.5.0", { min: "1.0.0", max: "2.0.0" });
	 * ```
	 */
	static satisfies(
		version: string,
		policy?: VersionPolicy
	): { valid: boolean; reason?: string } {
		if (!policy) {
			return { valid: true };
		}

		// Try semver parsing first
		const versionSemver = semver.valid(version);
		if (versionSemver) {
			if (policy.exact) {
				const exactSemver = semver.valid(policy.exact);
				if (exactSemver) {
					const valid = semver.eq(versionSemver, exactSemver);
					return {
						valid,
						reason:
							valid ? undefined : (
								`Expected exact version ${policy.exact}, got ${version}`
							),
					};
				}
			}

			if (policy.min) {
				const minSemver = semver.valid(policy.min);
				if (minSemver && !semver.gte(versionSemver, minSemver)) {
					return {
						valid: false,
						reason: `Version ${version} is below minimum ${policy.min}`,
					};
				}
			}

			if (policy.max) {
				const maxSemver = semver.valid(policy.max);
				if (maxSemver && !semver.lte(versionSemver, maxSemver)) {
					return {
						valid: false,
						reason: `Version ${version} is above maximum ${policy.max}`,
					};
				}
			}

			return { valid: true };
		}

		// Fallback to string comparison for non-semver versions
		if (policy.exact && version !== policy.exact) {
			return {
				valid: false,
				reason: `Expected exact version ${policy.exact}, got ${version}`,
			};
		}

		if (policy.min && version < policy.min) {
			return {
				valid: false,
				reason: `Version ${version} is below minimum ${policy.min}`,
			};
		}

		if (policy.max && version > policy.max) {
			return {
				valid: false,
				reason: `Version ${version} is above maximum ${policy.max}`,
			};
		}

		return { valid: true };
	}
}
