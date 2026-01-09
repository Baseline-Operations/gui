# Baseline Monorepo

This project has been refactored into a monorepo structure with three packages:

## Packages

### `@baseline/core`
Core library containing all baseline functionality:
- Configuration management
- Type definitions
- Utility functions
- Plugin system
- Command implementations (pure functions)

**Usage:**
```typescript
import { initWorkspace, addRepository } from "@baseline/core";
import { ConfigManager } from "@baseline/core/config";
import { Logger } from "@baseline/core/utils/logger";
```

### `@baseline/cli`
Command-line interface tool that uses `@baseline/core`:
- Commander.js command registration
- CLI wrappers for core functions
- Terminal output formatting

**Usage:**
```bash
pnpm --filter @baseline/cli dev init
pnpm --filter @baseline/cli build
```

### `@baseline/gui`
Electron GUI application that uses `@baseline/core`:
- Electron main process
- React renderer process
- IPC bridge to core functions

**Usage:**
```bash
pnpm --filter @baseline/gui dev
```

## Development

### Setup
```bash
pnpm install
```

### Build All Packages
```bash
pnpm build
```

### Build Individual Package
```bash
pnpm --filter @baseline/core build
pnpm --filter @baseline/cli build
pnpm --filter @baseline/gui build
```

### Development
```bash
# CLI
pnpm dev:cli

# GUI  
pnpm dev:gui
```

## Structure

```
baseline/
├── packages/
│   ├── core/          # Core library
│   ├── cli/           # CLI tool
│   └── gui/           # GUI app
├── package.json       # Root workspace
└── pnpm-workspace.yaml
```

## Self-Hosting

This monorepo is structured to allow baseline to manage itself:

1. Each package in `packages/` can be treated as a repository
2. The core package provides functionality used by CLI and GUI
3. Once built, baseline CLI can manage this workspace

See `.baseline/README.md` for self-hosting configuration.

## Migration Status

See `MONOREPO_STATUS.md` for detailed migration progress.

**Current Status:** ~30% complete
- ✅ Infrastructure setup
- ✅ Package structure
- ✅ All files migrated
- 🔄 Command refactoring in progress
- 🔄 CLI wrappers in progress
