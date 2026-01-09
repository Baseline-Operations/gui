# @baseline/gui

Electron-based GUI application for baseline. Provides a graphical interface for managing baseline workspaces.

## Installation

This package is typically built and distributed as a standalone application. See the main [baseline README](../README.md) for installation instructions.

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode
pnpm dev
```

## Package Structure

- `src/` - React application (renderer process)
- `electron/` - Electron main process
  - `main.ts` - Main process entry point
  - `preload.ts` - Preload script
  - `ipc/` - IPC handlers

## Technology Stack

- **Electron** - Desktop application framework
- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool

## Building

```bash
# Build the application
pnpm build

# Build for distribution
pnpm build:electron
```
