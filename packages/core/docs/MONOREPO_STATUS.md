# Monorepo Migration Status

## ✅ Completed

### Infrastructure
- [x] pnpm workspace configuration
- [x] Root package.json for workspace management
- [x] All three package directories created
- [x] Package.json files for all packages
- [x] TypeScript configs for all packages

### @baseline/core Package
- [x] All source files copied to `packages/core/src/`
- [x] Index files created for exports
- [x] Package.json with dependencies
- [x] TypeScript config
- [x] **Commands refactored (2/21):**
  - [x] `init.ts` → `initWorkspace()` (pure function)
  - [x] `add.ts` → `addRepository()` (pure function)
- [ ] **Remaining commands (19) need refactoring:**
  - [ ] `config.ts`
  - [ ] `doctor.ts`
  - [ ] `graph.ts`
  - [ ] `clone.ts`
  - [ ] `sync.ts`
  - [ ] `status.ts`
  - [ ] `branch.ts`
  - [ ] `pr.ts`
  - [ ] `exec.ts`
  - [ ] `test.ts`
  - [ ] `lint.ts`
  - [ ] `start.ts`
  - [ ] `watch.ts`
  - [ ] `docker-compose.ts`
  - [ ] `link.ts`
  - [ ] `release.ts`
  - [ ] `plugin.ts`

### @baseline/cli Package
- [x] Package structure created
- [x] Main CLI entry point (`cli.ts`)
- [x] All command registrations in CLI
- [x] **CLI wrappers created (2/21):**
  - [x] `init.ts` - Full implementation
  - [x] `add.ts` - Full implementation
- [ ] **Remaining CLI wrappers (19) need implementation**

### @baseline/gui Package
- [x] Package structure created
- [x] Electron main process (`electron/main.ts`)
- [x] Preload script (`electron/preload.ts`)
- [x] IPC handlers (`electron/ipc/commands.ts`, `config.ts`)
- [x] React app structure (`src/App.tsx`, `main.tsx`)
- [x] Vite config
- [x] TypeScript config
- [x] Type definitions for Electron API

## 🔄 Current State

### What Works
1. **Monorepo structure** - Fully set up and ready
2. **Core package exports** - All modules available for import
3. **Example refactoring** - `init` and `add` commands demonstrate the pattern

### What Needs Work
1. **Core commands** - 19 commands still have `Logger.*` and `process.exit()` calls
2. **CLI wrappers** - 19 wrappers need to be implemented
3. **Import paths** - Some imports may need adjustment
4. **Build system** - Need to test building all packages
5. **Tests** - Need to update test imports

## 📋 Next Steps

### Immediate (High Priority)
1. Continue refactoring core commands to pure functions
2. Create CLI wrappers for refactored commands
3. Test build process

### Short-term
4. Update all imports
5. Update tests
6. Fix any TypeScript errors

### Medium-term
7. Update documentation
8. Update CI/CD
9. Test full workflow

## 🎯 Refactoring Pattern

### Core Function Pattern
```typescript
// Before
export async function cloneCommand(): Promise<void> {
  Logger.title("Cloning...");
  // ... logic ...
  Logger.success("Done");
  if (error) process.exit(1);
}

// After
export interface CloneResult {
  success: boolean;
  cloned: number;
  skipped: number;
  errors: number;
  errorDetails?: Array<{ repo: string; error: string }>;
}

export async function cloneRepositories(
  options: { workspaceRoot?: string } = {}
): Promise<CloneResult> {
  // Pure logic - no logging, no exit
  return {
    success: errors === 0,
    cloned,
    skipped,
    errors,
    errorDetails: [...]
  };
}
```

### CLI Wrapper Pattern
```typescript
import { cloneRepositories } from "@baseline/core/commands/git/clone.js";
import { Logger } from "@baseline/core/utils/logger.js";

export async function cloneCommand(): Promise<void> {
  Logger.title("Cloning Repositories");
  
  const result = await cloneRepositories();
  
  Logger.title("Clone Summary");
  Logger.info(`Cloned: ${result.cloned}`);
  Logger.info(`Skipped: ${result.skipped}`);
  
  if (result.errors > 0) {
    Logger.warn(`Errors: ${result.errors}`);
    result.errorDetails?.forEach(d => {
      Logger.error(`  ${d.repo}: ${d.error}`);
    });
    process.exit(1);
  }
}
```

## 📊 Progress Summary

- **Infrastructure:** 100% ✅
- **Core Package Structure:** 100% ✅  
- **Core Commands Refactored:** 10% (2/21) 🔄
- **CLI Package Structure:** 100% ✅
- **CLI Wrappers Created:** 10% (2/21) 🔄
- **GUI Package Structure:** 100% ✅
- **Overall Migration:** ~30% 🔄

