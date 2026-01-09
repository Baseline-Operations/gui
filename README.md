# Baseline

A tool to manage multiple Git repositories as a single coordinated workspace.

## Quick Start

### Running Baseline on This Repository

This repository uses baseline to manage itself! After installing dependencies, you can run:

```bash
# Build the CLI (done automatically on install)
pnpm prepare

# Run baseline commands
pnpm bl status
pnpm bl doctor
pnpm bl exec "echo 'test'"
pnpm bl test
pnpm bl lint
```

### Custom Command Name

By default, baseline uses the command `bl`. You can customize this:

1. **Environment Variable:**
   ```bash
   export BASELINE_COMMAND=baseline
   ```

2. **Configuration File:**
   ```bash
   echo "baseline" > .baseline/command
   ```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run CLI in development mode
pnpm dev:cli -- <command>

# Run tests
pnpm test

# Lint
pnpm lint
```

## Package Structure

- `packages/core` - Core functionality library
- `packages/cli` - Command-line interface
- `packages/gui` - GUI application (future)

## Configuration

See `baseline.json` for workspace configuration. Packages can be:
- **Strings**: Simple paths like `"packages/core"` (local packages)
- **Objects**: External repos with `id`, `location`, and optional `version`

Example:
```json
{
  "packages": [
    "packages/core",
    {
      "id": "external-lib",
      "location": "https://github.com/user/repo.git",
      "version": "main"
    }
  ]
}
```
