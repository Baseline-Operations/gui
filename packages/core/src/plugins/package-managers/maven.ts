import {
	PackageManagerPlugin,
} from "../types.js";
import { execa } from "execa";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Built-in Maven package manager plugin for Java.
 */
const mavenPlugin: PackageManagerPlugin = {
	metadata: {
		id: "maven",
		name: "Maven",
		version: "1.0.0",
		description: "Maven build tool support for Java",
		type: "package-manager",
		baselineVersion: "0.1.0",
		requiresLanguages: ["java"],
	},

	async isInstalled(): Promise<boolean> {
		try {
			await execa("mvn", ["--version"], { timeout: 5000 });
			return true;
		} catch {
			return false;
		}
	},

	async getVersion(): Promise<string | null> {
		try {
			const { stdout } = await execa("mvn", ["--version"], {
				timeout: 5000,
			});
			const match = stdout.match(/Apache Maven (\d+\.\d+\.\d+)/);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	},

	getInstallCommand(): string {
		return "mvn install";
	},

	getRunCommand(): string[] {
		return ["mvn"];
	},

	async createWorkspaceConfig(
		repos: Array<{ path: string; name: string }>,
		workspaceRoot: string
	): Promise<{ file: string; content: string } | null> {
		const modules = repos
			.filter((r) => existsSync(join(workspaceRoot, r.path, "pom.xml")))
			.map((r) => r.path);

		if (modules.length === 0) {
			return null;
		}

		// Maven parent POM with modules
		const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.baseline</groupId>
    <artifactId>baseline-workspace</artifactId>
    <version>1.0.0</version>
    <packaging>pom</packaging>
    <modules>
${modules.map((m) => `        <module>${m}</module>`).join("\n")}
    </modules>
</project>
`;

		return {
			file: "pom.xml",
			content,
		};
	},
};

export default mavenPlugin;

