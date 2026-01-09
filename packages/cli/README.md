# @baseline/cli

Command-line interface for baseline - a tool to manage multiple Git repositories as a single coordinated workspace.

## Installation

```bash
npm install -g @baseline/cli
# or
pnpm add -g @baseline/cli
# or
yarn global add @baseline/cli
```

## Usage

See the main [baseline README](../README.md) for usage instructions.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm dev -- <command>
```

## Package Structure

- `src/cli.ts` - Main CLI entry point (Commander.js)
- `src/commands/` - CLI command wrappers that call `@baseline/core`
- `.baseline/` - Workspace configuration directory
