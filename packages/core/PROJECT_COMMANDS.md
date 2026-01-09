# Per-Repository Commands and Project Configuration

This document describes the per-repository command configuration system and project-specific settings.

## Overview

Each repository in a baseline workspace can have its own test, lint, and start commands configured. These commands can be defined in:

1. **`baseline.json`** - At the workspace level in the repo entry
2. **`baseline.project.json`** - In each repository's root directory (recommended)

## Configuration Hierarchy

Commands are resolved in the following priority order:

1. `baseline.project.json` in the repository root
2. `baseline.json` repository entry
3. `package.json` scripts (for test and lint only - **not** for start)

**Note**: Start commands are **never** auto-detected from `package.json` for safety reasons. They must be explicitly configured.

## Repository Schema Updates

### baseline.json Repository Entry

```json
{
	"name": "my-repo",
	"gitUrl": "https://github.com/user/my-repo.git",
	"defaultBranch": "main",
	"path": "repos/my-repo",
	"library": false,
	"commands": {
		"test": "test",
		"lint": "lint",
		"start": "start"
	},
	"startInDocker": false,
	"dockerImage": "node:20"
}
```

### baseline.project.json

Located in each repository's root directory:

```json
{
	"name": "my-repo",
	"library": false,
	"commands": {
		"test": "vitest",
		"lint": "eslint .",
		"start": "node server.js"
	},
	"startInDocker": true,
	"dockerImage": "node:20"
}
```

## Commands

### `baseline config`

Generate or update `baseline.project.json` files for repositories.

```bash
# Generate config for all repos
baseline config

# Generate config for specific repo
baseline config --repo my-repo

# Force overwrite existing configs
baseline config --force
```

This command:

- Detects default commands from `package.json` scripts
- Merges with existing `baseline.project.json` (if present)
- Merges with `baseline.json` repo configuration
- Creates `baseline.project.json` with the resolved commands

### `baseline test`

Run test and lint commands for all repositories.

```bash
# Run tests for all repos
baseline test

# Filter by tag
baseline test --filter tag=lib

# Filter by name
baseline test --filter name=my-repo

# Filter libraries only
baseline test --filter library

# Run in parallel
baseline test --parallel

# Stop on first failure
baseline test --fail-fast
```

**Behavior**:

- Runs lint command first (if available)
- Then runs test command (if available)
- Skips repos without commands configured (or logs a dim message)
- Exits with code 1 if any repo fails

### `baseline lint`

Run lint commands for all repositories.

```bash
# Run linters for all repos
baseline lint

# Filter and parallel options same as test
baseline lint --filter tag=lib --parallel
```

### `baseline start`

Start applications across repositories.

```bash
# Start all configured apps
baseline start

# Start specific repos
baseline start --filter name=frontend,name=backend
```

**Behavior**:

- **Only** starts repos with explicitly configured start commands
- Does **not** auto-detect from `package.json` (for safety)
- Runs commands in background by default
- Supports Docker container execution if `startInDocker: true`

**Docker Support**:

- If `startInDocker: true`, runs the start command in a Docker container
- Uses `dockerImage` or defaults to `node:20`
- Creates a container named `baseline-{repo-name}`
- Runs in detached mode (`-d`)

### `baseline watch`

Watch library repositories for file changes and automatically run tests.

```bash
# Watch all libraries
baseline watch

# Watch specific libraries
baseline watch --filter name=my-lib
```

**Behavior**:

- **Only** watches repositories marked as `library: true`
- Automatically runs test and lint when files change
- Debounced by 1 second to avoid excessive runs
- Ignores changes in `node_modules`, `.git`, `dist`, `build`, `coverage`, `.vitest`
- Press Ctrl+C to stop watching

## Library Flag

Repositories can be marked as libraries:

```json
{
	"library": true
}
```

**Purpose**:

- Libraries are watched by `baseline watch`
- Non-libraries are ignored by watch mode
- Helps distinguish between applications and reusable packages

## Adding Repositories with Commands

When adding a repository, you can configure commands:

```bash
baseline add https://github.com/user/repo.git \
  --name my-repo \
  --library \
  --test "vitest" \
  --lint "eslint ." \
  --start "node server.js" \
  --start-in-docker \
  --docker-image "node:20"
```

## Default Command Detection

For **test** and **lint** commands only, baseline will check `package.json` scripts if no explicit command is configured:

```json
{
	"scripts": {
		"test": "vitest",
		"lint": "eslint ."
	}
}
```

These will be automatically used if not found in `baseline.project.json` or `baseline.json`.

**Start commands are never auto-detected** - they must be explicitly configured for safety.

## Examples

### Example 1: Node.js Library

```json
// baseline.project.json
{
	"name": "my-utils",
	"library": true,
	"commands": {
		"test": "vitest",
		"lint": "eslint ."
	}
}
```

### Example 2: Application with Docker

```json
// baseline.project.json
{
	"name": "my-api",
	"library": false,
	"commands": {
		"test": "npm test",
		"lint": "npm run lint",
		"start": "node server.js"
	},
	"startInDocker": true,
	"dockerImage": "node:20"
}
```

### Example 3: Workspace-Level Configuration

```json
// baseline.json
{
	"repos": [
		{
			"name": "shared-lib",
			"gitUrl": "https://github.com/user/shared-lib.git",
			"path": "libs/shared",
			"library": true,
			"commands": {
				"test": "vitest",
				"lint": "eslint ."
			}
		}
	]
}
```

## Best Practices

1. **Use `baseline.project.json`** for per-repo configuration - it's easier to manage and version control alongside the repo
2. **Mark libraries** with `library: true` if they're reusable packages
3. **Never auto-configure start commands** - always explicitly set them to avoid accidentally starting services
4. **Use Docker for isolation** - if a service needs specific environment setup, use `startInDocker: true`
5. **Run `baseline config`** after cloning repos to generate project configs
6. **Version control `baseline.project.json`** - commit it to each repository so all developers use the same commands
