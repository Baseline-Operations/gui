# @baseline/core

Core baseline functionality library. This package contains all the core logic that can be used by the CLI, GUI, or any other consumer.

## Installation

```bash
npm install @baseline/core
# or
pnpm add @baseline/core
# or
yarn add @baseline/core
```

## Usage

```typescript
import { ConfigManager, initWorkspace, addRepository } from '@baseline/core';
import { Logger } from '@baseline/core/utils/logger';
import { GitUtil } from '@baseline/core/utils/git';

// Initialize a workspace
const result = await initWorkspace({ workspaceRoot: './my-workspace' });

// Add a repository
const addResult = await addRepository('https://github.com/user/repo.git', {
  name: 'my-repo',
  workspaceRoot: './my-workspace'
});

// Manage configuration
const configManager = new ConfigManager();
const config = await configManager.load();
```

## Package Structure

- `src/config/` - Configuration management
- `src/types/` - TypeScript types and Zod schemas
- `src/utils/` - Utility functions (logger, git, etc.)
- `src/plugins/` - Plugin system
- `src/commands/` - Command implementations (pure functions)

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Test
pnpm test
```
