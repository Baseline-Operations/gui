import {
	LanguagePlugin,
	LanguagePluginOptions,
	CommandDiscovery,
	ProjectFile,
} from "../types.js";
import { LanguageProfile } from "../types.js";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Built-in Java language plugin.
 * Supports Java projects with Maven, Gradle, or Ant build systems.
 */
const javaPlugin: LanguagePlugin = {
	metadata: {
		id: "java",
		name: "Java",
		version: "1.0.0",
		description: "Support for Java projects (Maven, Gradle, Ant)",
		type: "language",
		baselineVersion: "0.1.0",
	},

	getLanguageProfile(options: LanguagePluginOptions = {}): LanguageProfile {
		const toolchain = [
			{
				name: "java",
				versionPolicy: options.versionPolicies?.java,
			},
		];

		// Add Maven if specified
		if (options.versionPolicies?.maven) {
			toolchain.push({
				name: "maven",
				versionPolicy: options.versionPolicies.maven,
			});
		}

		// Add Gradle if specified
		if (options.versionPolicies?.gradle) {
			toolchain.push({
				name: "gradle",
				versionPolicy: options.versionPolicies.gradle,
			});
		}

		return {
			displayName: "Java",
			toolchain,
			projectMarkers: [
				"pom.xml", // Maven
				"build.gradle", // Gradle
				"build.gradle.kts", // Gradle Kotlin DSL
				"build.xml", // Ant
			],
		};
	},

	getDetectionCommand(toolName: string): { command: string; args?: string[] } | null {
		const detectionMap: Record<string, { command: string; args?: string[] }> = {
			java: { command: "java", args: ["-version"] },
			maven: { command: "mvn", args: ["--version"] },
			gradle: { command: "gradle", args: ["--version"] },
		};
		return detectionMap[toolName] || null;
	},

	async detectLanguage(repoPath: string): Promise<boolean> {
		return (
			existsSync(join(repoPath, "pom.xml")) ||
			existsSync(join(repoPath, "build.gradle")) ||
			existsSync(join(repoPath, "build.gradle.kts")) ||
			existsSync(join(repoPath, "build.xml"))
		);
	},

	async discoverCommands(
		repoPath: string,
		_options?: { packageManager?: string }
	): Promise<CommandDiscovery | null> {
		// Check for Maven
		if (existsSync(join(repoPath, "pom.xml"))) {
			return {
				test: "mvn test",
				lint: "mvn checkstyle:check", // Common Maven linting
			};
		}

		// Check for Gradle
		if (
			existsSync(join(repoPath, "build.gradle")) ||
			existsSync(join(repoPath, "build.gradle.kts"))
		) {
			return {
				test: "gradle test",
				lint: "gradle check", // Common Gradle linting/checking
			};
		}

		// Check for Ant (less common, but support it)
		if (existsSync(join(repoPath, "build.xml"))) {
			return {
				test: "ant test",
			};
		}

		return null;
	},

	getProjectFiles(): ProjectFile[] {
		return [
			{
				path: "pom.xml",
				required: false,
				description: "Maven project file",
			},
			{
				path: "build.gradle",
				required: false,
				description: "Gradle build file",
			},
			{
				path: "build.gradle.kts",
				required: false,
				description: "Gradle Kotlin DSL build file",
			},
			{
				path: "settings.gradle",
				required: false,
				description: "Gradle settings file",
			},
		];
	},

	async getCommandRunner(
		repoPath: string,
		_options?: { packageManager?: string }
	): Promise<{ runner: string; args: string[] } | null> {
		// For Maven projects
		if (existsSync(join(repoPath, "pom.xml"))) {
			return { runner: "mvn", args: [] };
		}

		// For Gradle projects
		if (
			existsSync(join(repoPath, "build.gradle")) ||
			existsSync(join(repoPath, "build.gradle.kts"))
		) {
			return { runner: "gradle", args: [] };
		}

		// For Ant projects
		if (existsSync(join(repoPath, "build.xml"))) {
			return { runner: "ant", args: [] };
		}

		return null;
	},
};

export default javaPlugin;

