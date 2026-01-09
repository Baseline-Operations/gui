# Monorepo Migration Plan

## Overview

Refactoring baseline into a monorepo with three packages:

1. **`@baseline/core`** - Core library with all functionality (config, utils, plugins, types)
2. **`@baseline/cli`** - Command-line interface package
3. **`@baseline/gui`** - Electron GUI application package

## New Structure

```
baseline/
├── packages/
│   ├── core/                   # @baseline/core
│   │   ├── src/
│   │   │   ├── config/         # ConfigManager
│   │   │   ├── types/          # TypeScript types & Zod schemas
│   │   │   ├── utils/          # All utilities (logger, git, etc.)
│   │   │   ├── plugins/        # Plugin system
│   │   │   └── commands/       # Command implementations (shared logic)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cli/                    # @baseline/cli
│   │   ├── src/
│   │   │   ├── cli.ts          # CLI entry point (Commander.js)
│   │   │   └── commands/       # CLI command wrappers (thin layer)
│   │   ├── bin/
│   │   │   ├── bl.js           # CLI binary
│   │   │   └── baseline.js     # CLI binary alias
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── gui/                    # @baseline/gui
│       ├── electron/           # Electron main process
│       ├── src/                # React application
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # pnpm workspace config
├── tsconfig.json               # Root TypeScript config
└── ...                         # Root-level files (docs, etc.)
```

## Migration Steps

### Step 1: Set up Monorepo Infrastructure

1. Create `pnpm-workspace.yaml` at root
2. Update root `package.json` for workspace management
3. Create package directories

### Step 2: Create @baseline/core Package

**Move to core:**

- `src/config/` → `packages/core/src/config/`
- `src/types/` → `packages/core/src/types/`
- `src/utils/` → `packages/core/src/utils/`
- `src/plugins/` → `packages/core/src/plugins/`
- Command logic (keep implementation, remove CLI-specific parts)

**Export from core:**

```typescript
// packages/core/src/index.ts
export * from "./config";
export * from "./types";
export * from "./utils";
export * from "./plugins";
export * from "./commands"; // Command functions, not CLI wrappers
```

### Step 3: Create @baseline/cli Package

**Keep in CLI:**

- `src/cli.ts` (Commander.js setup)
- CLI command wrappers (thin layer that calls core)

**CLI commands structure:**

```typescript
// packages/cli/src/commands/init.ts
import { initWorkspace } from "@baseline/core";

export async function initCommand(options: InitOptions) {
	// CLI-specific: parse options, validate inputs
	// Call core function
	await initWorkspace(options);
}
```

### Step 4: Create @baseline/gui Package

**New package:**

- Follow GUI_ARCHITECTURE.md
- Use `@baseline/core` for all functionality
- Electron IPC layer calls core functions

### Step 5: Update Dependencies

**@baseline/core dependencies:**

- All current dependencies except Commander.js
- Remove CLI-specific dependencies

**@baseline/cli dependencies:**

- `@baseline/core` (local workspace)
- Commander.js
- Minimal additional dependencies

**@baseline/gui dependencies:**

- `@baseline/core` (local workspace)
- Electron
- React
- UI library

### Step 6: Update Build System

- Each package builds independently
- Root level can build all packages
- Shared TypeScript config where possible

## Package Details

### @baseline/core

**Exports:**

```typescript
// Config
export { ConfigManager } from './config/manager';
export type { BaselineConfig, Repo, ... } from './types/config';

// Utils
export { Logger } from './utils/logger';
export { GitUtil } from './utils/git';
export { PackageManagerUtil } from './utils/package-manager';
// ... etc

// Plugins
export { PluginManager } from './plugins/manager';
export type { Plugin, LanguagePlugin, ... } from './plugins/types';

// Commands (function implementations)
export { initWorkspace } from './commands/workspace/init';
export { addRepository } from './commands/workspace/add';
// ... etc
```

**No CLI dependencies:**

- Pure functions and classes
- Can be used by CLI, GUI, or any consumer

### @baseline/cli

**Minimal wrapper:**

- Commander.js command registration
- Option parsing and validation
- Calls core functions
- Handles output formatting for terminal

**Binary:**

```json
{
	"bin": {
		"bl": "./dist/bin/bl.js",
		"baseline": "./dist/bin/baseline.js"
	}
}
```

### @baseline/gui

**Full GUI application:**

- Electron main/renderer processes
- React UI
- Uses `@baseline/core` for all operations
- IPC bridge between Electron and core

## Plugin Installation

**Current behavior (maintained):**

- Plugins install to workspace `.baseline/.plugins/` directory
- Not globally installed
- Workspace-specific configuration

**No changes needed:**

- Plugin system remains workspace-scoped
- Each workspace can have different plugins

## Build & Development

**Root scripts:**

```json
{
	"scripts": {
		"build": "pnpm -r build",
		"dev:cli": "pnpm --filter @baseline/cli dev",
		"dev:gui": "pnpm --filter @baseline/gui dev",
		"test": "pnpm -r test"
	}
}
```

**Package scripts:**

- Each package has its own build/test scripts
- Can develop packages independently
- Workspace linking handles dependencies

## Benefits

1. **Separation of Concerns**: Core logic separate from CLI/GUI
2. **Reusability**: Core can be used by any consumer
3. **Testability**: Core can be tested independently
4. **Maintainability**: Clear boundaries between packages
5. **Extensibility**: Easy to add new interfaces (e.g., REST API)

## Migration Checklist

- [x] Set up monorepo structure (pnpm workspaces)
- [x] Create @baseline/core package
- [x] Move core modules to @baseline/core
- [x] Export core API (index.ts files created)
- [x] Create @baseline/cli package structure
- [x] Create CLI entry point
- [x] Create @baseline/gui package scaffold
- [x] Create Electron main process structure
- [x] Create React app structure
- [x] Create IPC handlers for commands and config
- [ ] Refactor all commands to pure functions (2/21 done)
- [ ] Create all CLI wrappers (2/21 done)
- [ ] Remove Logger/process.exit from core commands
- [ ] Update all imports (relative paths in core)
- [ ] Update build system
- [ ] Update tests
- [ ] Update documentation
- [ ] Test CLI functionality
- [ ] Test plugin system
- [ ] Update CI/CD

## Progress Notes

### Completed

- Monorepo structure with pnpm workspaces
- Core package with all modules copied
- CLI package structure and entry point
- GUI package structure with Electron and React
- Example refactoring: `init` and `add` commands

### In Progress

- Command refactoring (removing Logger/process.exit from core)
- CLI wrapper creation
- Import path updates

### Next Steps

1. Continue refactoring remaining commands (19 left)
2. Create remaining CLI wrappers
3. Fix any import issues
4. Test build system
