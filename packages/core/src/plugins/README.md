# Baseline Plugin System

This document describes the plugin system architecture for extending baseline functionality.

## Overview

Baseline uses a plugin-based architecture to support extensibility. Plugins can provide:
- **Language Support**: Toolchain definitions, project markers, version policies, command discovery
- **Provider Integration**: Git hosting services (GitHub, GitLab, Bitbucket)
- **Package Manager Support**: Custom package managers for different languages
- **Editor Integration**: IDE/editor-specific features and workspace generation

## Plugin Types

### Language Plugins

Language plugins provide support for programming languages:

- **Node.js / TypeScript / JavaScript** (`node`) - Built-in ✅
- **Python** (`python`) - Built-in ✅
- **Go** (`go`) - Built-in ✅
- **Rust** (`rust`) - Built-in ✅
- **Java** (`java`) - Built-in ✅ (Maven, Gradle, Ant)

### Provider Plugins

Provider plugins integrate with Git hosting services:

- **GitHub** (`github`) - Built-in ✅
- **GitLab** (`gitlab`) - Built-in ✅ (uses glab CLI)
- **Bitbucket** (`bitbucket`) - Built-in ✅ (uses bb CLI or manual)

### Package Manager Plugins

Package manager plugins support different package managers:

- **npm** (`npm`) - Built-in ✅ (Node.js)
- **pnpm** (`pnpm`) - Built-in ✅ (Node.js)
- **yarn** (`yarn`) - Built-in ✅ (Node.js)
- **pip** (`pip`) - Built-in ✅ (Python)
- **Cargo** (`cargo`) - Built-in ✅ (Rust)
- **Maven** (`maven`) - Built-in ✅ (Java)
- **Gradle** (`gradle`) - Built-in ✅ (Java)
- Custom package managers - Supported via plugins

### Editor Plugins

Editor plugins provide IDE/editor integrations:

- **VS Code** (`vscode`) - Built-in ✅
- **Cursor** (`cursor`) - Built-in ✅
- **IntelliJ IDEA / JetBrains** (`intellij`) - Built-in ✅
- **Sublime Text** (`sublime`) - Built-in ✅
- Other editors - Supported via plugins

## Built-in Plugins

Built-in plugins are organized by type in dedicated directories:

### Language Plugins (`src/plugins/languages/`)
- `node.ts` - Node.js/TypeScript/JavaScript support
- `python.ts` - Python support
- `go.ts` - Go support
- `rust.ts` - Rust support
- `index.ts` - Language plugin registration

### Provider Plugins (`src/plugins/providers/`)
- `github.ts` - GitHub provider (PR creation, repository management)
- `index.ts` - Provider plugin registration
- TODO: `gitlab.ts` - GitLab provider
- TODO: `bitbucket.ts` - Bitbucket provider

### Package Manager Plugins (`src/plugins/package-managers/`)
- `npm.ts` - npm package manager support
- `pnpm.ts` - pnpm package manager support
- `yarn.ts` - yarn package manager support
- `index.ts` - Package manager plugin registration

### Editor Plugins (`src/plugins/editors/`)
- `vscode.ts` - VS Code workspace file generation
- `cursor.ts` - Cursor workspace file generation
- `index.ts` - Editor plugin registration

All plugins are loaded via `src/plugins/builtin/index.ts`.

## Creating a Plugin

### Language Plugin Example

```typescript
import { LanguagePlugin, PluginMetadata, LanguagePluginOptions } from "../types.js";
import { LanguageProfile } from "../../types/config.js";
import { existsSync } from "fs";
import { join } from "path";

const myLanguagePlugin: LanguagePlugin = {
  metadata: {
    id: "mylang",
    name: "My Language",
    version: "1.0.0",
    description: "Support for my custom language",
    type: "language",
    baselineVersion: "0.1.0", // Optional: minimum baseline version
  },

  getLanguageProfile(options: LanguagePluginOptions = {}): LanguageProfile {
    return {
      displayName: "My Language",
      toolchain: [
        {
          name: "mylang-compiler",
          versionPolicy: options.versionPolicies?.mylangCompiler,
          detection: {
            command: "mylangc",
            args: ["--version"],
          },
        },
      ],
      projectMarkers: ["mylang.json", "mylang.lock"],
    };
  },

  async detectLanguage(repoPath: string): Promise<boolean> {
    return existsSync(join(repoPath, "mylang.json"));
  },

  async discoverCommands(repoPath: string): Promise<CommandDiscovery | null> {
    // Discover commands from mylang.json or other config files
    // ...
  },
};

export default myLanguagePlugin;
```

### Provider Plugin Example

```typescript
import { ProviderPlugin, PluginMetadata } from "../types.js";

const myProviderPlugin: ProviderPlugin = {
  metadata: {
    id: "myprovider",
    name: "My Git Provider",
    version: "1.0.0",
    type: "provider",
    baselineVersion: "0.1.0",
  },

  matchesUrl(url: string): boolean {
    return url.includes("myprovider.com");
  },

  async createPullRequest(options) {
    // Implementation for PR creation
    // ...
  },
};

export default myProviderPlugin;
```

### Package Manager Plugin Example

```typescript
import { PackageManagerPlugin, PluginMetadata } from "../types.js";

const myPmPlugin: PackageManagerPlugin = {
  metadata: {
    id: "mypm",
    name: "My Package Manager",
    version: "1.0.0",
    type: "package-manager",
    baselineVersion: "0.1.0",
    requiresLanguages: ["mylang"], // Requires a specific language
  },

  async isInstalled(): Promise<boolean> {
    // Check if package manager is installed
  },

  getRunCommand(): string[] {
    return ["mypm", "run"];
  },

  async createWorkspaceConfig(repos, workspaceRoot) {
    // Generate workspace configuration
    return { file: "mypm-workspace.json", content: "..." };
  },
};

export default myPmPlugin;
```

### Editor Plugin Example

```typescript
import { EditorPlugin, PluginMetadata } from "../types.js";

const myEditorPlugin: EditorPlugin = {
  metadata: {
    id: "myeditor",
    name: "My Editor",
    version: "1.0.0",
    type: "editor",
    baselineVersion: "0.1.0",
  },

  async generateWorkspaceFile(config, workspaceRoot) {
    return {
      file: ".myeditor-workspace",
      content: JSON.stringify({ ... }, null, 2),
    };
  },
};

export default myEditorPlugin;
```

### Plugin Package Example

A plugin package can export multiple plugins:

```typescript
// .baseline/plugins/my-plugin-package/index.js
import myLanguagePlugin from "./language.js";
import myProviderPlugin from "./provider.js";

export default {
  metadata: {
    name: "my-plugin-package",
    version: "1.0.0",
    description: "Package containing multiple plugins",
    baselineVersion: "0.1.0",
  },
  plugins: [
    myLanguagePlugin,
    myProviderPlugin,
  ],
  dependencies: [
    { pluginId: "node", version: ">=1.0.0" }, // Requires node plugin
  ],
  requiresLanguages: ["node"], // Requires node language
};
```

## Plugin Discovery

### Built-in Plugins

Built-in plugins are automatically loaded from organized directories:
- `src/plugins/languages/` - Language plugins
- `src/plugins/providers/` - Provider plugins (GitHub, GitLab, etc.)
- `src/plugins/package-managers/` - Package manager plugins (npm, pnpm, yarn)
- `src/plugins/editors/` - Editor plugins (VS Code, Cursor)

### External Plugins

External plugins can be loaded from:

1. **Workspace Plugins**: `.baseline/plugins/` directory ✅
   - Place plugin files (`.js`, `.mjs`, or `.cjs`) in `.baseline/plugins/`
   - Or create a directory with `index.js` for plugin packages
   - Plugins are automatically loaded when the workspace is initialized
   - External plugins cannot override built-in plugins (by ID)
   - Supports single plugin files or plugin packages (multiple plugins)
2. **npm Packages** (TODO): Packages with `baseline-plugin` keyword
3. **Remote Registry** (TODO): Plugin registry URL

## Plugin Dependencies and Requirements

Plugins can declare:
- **Dependencies**: Other plugins they require (via `metadata.requires`)
- **Baseline Version**: Minimum baseline version (via `metadata.baselineVersion`)
- **Required Languages**: Language IDs they need (via `metadata.requiresLanguages`)

Example:
```typescript
{
  metadata: {
    id: "my-pm-plugin",
    type: "package-manager",
    baselineVersion: "0.2.0", // Requires baseline >= 0.2.0
    requires: [
      { pluginId: "node", version: ">=1.0.0" },
    ],
    requiresLanguages: ["node"],
  },
  // ...
}
```

## Plugin Configuration

### Workspace-level Configuration (`baseline.json`)

Plugins can be referenced in `baseline.json`:

```json
{
  "languages": {
    "node": { /* auto-generated from plugin */ },
    "mylang": { /* from external plugin */ }
  },
  "plugins": {
    "enabled": ["mylang", "custom-provider"],
    "config": {
      "mylang": {
        "customOption": "value"
      }
    },
    "dependencies": {
      "my-language-plugin": {
        "source": "npm",
        "version": "^1.0.0",
        "url": "baseline-plugin-typescript"
      }
    }
  }
}
```

### Repository-level Configuration (`baseline.project.json`)

Each repository can specify its own required plugins in `baseline.project.json`:

```json
{
  "name": "my-repo",
  "library": false,
  "commands": {
    "test": "npm test",
    "lint": "npm run lint"
  },
  "requiredPlugins": {
    "my-language-plugin": {
      "source": "npm",
      "version": "^1.0.0",
      "url": "baseline-plugin-typescript"
    },
    "my-custom-plugin": {
      "source": "git",
      "url": "https://github.com/user/baseline-custom-plugin.git",
      "version": "v1.2.0"
    },
    "local-plugin": {
      "source": "local",
      "path": "../plugins/local-plugin"
    }
  }
}
```

Repository-level `requiredPlugins` take precedence and are automatically installed when the repository is checked. This allows each repository to specify its exact plugin dependencies with versions and sources.

## Plugin API

### LanguagePlugin

```typescript
interface LanguagePlugin {
  metadata: PluginMetadata;
  getLanguageProfile(options?: LanguagePluginOptions): LanguageProfile;
  getPrompts?(): Array<any>; // Optional prompts for version policies
  validate?(config: unknown): { valid: boolean; error?: string };
  discoverCommands?(repoPath: string, options?: { packageManager?: string }): Promise<CommandDiscovery | null>;
  getProjectFiles?(): ProjectFile[];
  detectLanguage?(repoPath: string): Promise<boolean>;
  getCommandRunner?(repoPath: string, options?: { packageManager?: string }): Promise<{ runner: string; args: string[] } | null>;
}
```

### ProviderPlugin

```typescript
interface ProviderPlugin {
  metadata: PluginMetadata;
  createPullRequest?(options: {...}): Promise<string>;
  getRepoUrlPattern?(): string | RegExp;
  matchesUrl?(url: string): boolean;
}
```

### PackageManagerPlugin

```typescript
interface PackageManagerPlugin {
  metadata: PluginMetadata;
  createWorkspaceConfig?(repos: Array<{...}>, workspaceRoot: string): Promise<{ file: string; content: string } | null>;
  getInstallCommand?(): string;
  getRunCommand?(): string[];
  isInstalled?(): Promise<boolean>;
  getVersion?(): Promise<string | null>;
}
```

### EditorPlugin

```typescript
interface EditorPlugin {
  metadata: PluginMetadata;
  generateWorkspaceFile?(config: BaselineConfig, workspaceRoot: string): Promise<{ file: string; content: string }>;
}
```

### PluginMetadata

```typescript
interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  type: "language" | "provider" | "package-manager" | "editor" | "other";
  baselineVersion?: string; // Minimum baseline version required
  requires?: PluginDependency[]; // Plugin dependencies
  requiresLanguages?: string[]; // Required language IDs
}
```

### PluginPackage

```typescript
interface PluginPackage {
  metadata: {
    name: string;
    version: string;
    description?: string;
    author?: string;
    baselineVersion?: string;
  };
  plugins: BaselinePlugin[];
  dependencies?: PluginDependency[];
  requiresLanguages?: string[];
}
```

## Using Plugins

### In Commands

```typescript
import { PluginManager } from "../plugins/manager.js";

const pluginManager = PluginManager.getInstance();
await pluginManager.initialize();

// Get a language plugin
const languagePlugin = pluginManager.getPlugin("node");
if (languagePlugin && languagePlugin.metadata.type === "language") {
  const profile = (languagePlugin as LanguagePlugin).getLanguageProfile({
    packageManager: "npm",
  });
  // Use profile...
}

// Get a provider plugin
const providerPlugin = pluginManager.getPlugin("github");
if (providerPlugin && providerPlugin.metadata.type === "provider") {
  const pr = await (providerPlugin as ProviderPlugin).createPullRequest?.({
    // ...
  });
}

// Get package manager plugins
const pmPlugins = pluginManager.getPluginsByType("package-manager");
```

## Best Practices

1. **Keep plugins focused**: One plugin should do one thing well
2. **Version your plugins**: Use semantic versioning
3. **Document your plugin**: Provide clear descriptions and examples
4. **Declare dependencies**: Use `requires` and `requiresLanguages` to declare what your plugin needs
5. **Check baseline version**: Declare minimum baseline version if your plugin uses newer features
6. **Test your plugin**: Ensure it works with the plugin system
7. **Handle errors gracefully**: Plugins should not crash the main application

## Plugin Organization

All built-in plugins are organized in type-specific directories:

```
src/plugins/
├── types.ts              # Plugin type definitions
├── manager.ts            # Plugin manager
├── builtin/
│   └── index.ts          # Main registration file
├── languages/            # Language plugins
│   ├── node.ts
│   ├── python.ts
│   ├── go.ts
│   ├── rust.ts
│   └── index.ts
├── providers/            # Provider plugins
│   ├── github.ts
│   └── index.ts
├── package-managers/     # Package manager plugins
│   ├── npm.ts
│   ├── pnpm.ts
│   ├── yarn.ts
│   └── index.ts
└── editors/              # Editor plugins
    ├── vscode.ts
    ├── cursor.ts
    └── index.ts
```

External plugins should be placed in `.baseline/plugins/` and follow the same structure if organizing as a package.
