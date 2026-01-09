# Monorepo Refactor Guide

## Overview

This document outlines the ongoing refactor to split baseline into three packages:
1. `@baseline/core` - Core library
2. `@baseline/cli` - CLI tool
3. `@baseline/gui` - Electron GUI

## Current Status

✅ **Completed:**
- Monorepo structure created
- Package.json files created for all three packages
- pnpm workspace configured
- Core package structure created
- Files copied to core package
- CLI package structure started

🔄 **In Progress:**
- Updating imports in core package (relative paths)
- Creating CLI wrapper commands
- Refactoring commands to be pure functions (return results, no Logger/process.exit)

📋 **Remaining:**
- Update all command files to use @baseline/core imports
- Refactor commands to return results instead of logging
- Create all CLI wrapper commands
- Create GUI package scaffold
- Update tests
- Update build system
- Update documentation

## Key Changes Needed

### 1. Core Package Commands

**Current (CLI-specific):**
```typescript
export async function initCommand(options: InitOptions): Promise<void> {
  Logger.title("Initializing workspace");
  // ... logic ...
  Logger.success("Done");
  process.exit(0);
}
```

**New (Pure function):**
```typescript
export interface InitResult {
  success: boolean;
  workspaceRoot: string;
  configPath: string;
  errors?: string[];
}

export async function initWorkspace(options: InitOptions): Promise<InitResult> {
  // ... logic ...
  return {
    success: true,
    workspaceRoot,
    configPath
  };
}
```

### 2. CLI Wrapper Commands

**New pattern:**
```typescript
// packages/cli/src/commands/workspace/init.ts
import { initWorkspace } from "@baseline/core/commands/workspace/init.js";
import { Logger } from "@baseline/core/utils/logger.js";

export async function initCommand(options: InitOptions): Promise<void> {
  try {
    const result = await initWorkspace(options);
    if (result.success) {
      Logger.success(`Workspace initialized at ${result.workspaceRoot}`);
    } else {
      Logger.error("Failed to initialize workspace");
      result.errors?.forEach(err => Logger.error(err));
      process.exit(1);
    }
  } catch (error) {
    Logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
```

### 3. Import Updates

**In core package, all imports should be relative:**
```typescript
// packages/core/src/commands/workspace/init.ts
import { ConfigManager } from "../../config/manager.js";
import { Logger } from "../../utils/logger.js";
import { BaselineConfig } from "../../types/config.js";
```

**In CLI package, import from @baseline/core:**
```typescript
// packages/cli/src/commands/workspace/init.ts
import { initWorkspace } from "@baseline/core/commands/workspace/init.js";
import { Logger } from "@baseline/core/utils/logger.js";
```

## Migration Script

To help with the refactor, we need to:

1. **Update all imports in core package** to use relative paths
2. **Refactor command functions** to return results instead of logging
3. **Create CLI wrappers** for all commands
4. **Update tests** to use new structure

## Next Steps

1. Finish updating imports in core package
2. Refactor one command at a time (start with init)
3. Create corresponding CLI wrapper
4. Test each command
5. Repeat for all commands

