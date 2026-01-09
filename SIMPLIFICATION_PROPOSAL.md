# Configuration Simplification Proposal

## Analysis Results

After analyzing the codebase:

1. **`config.name`, `config.version`, `config.private`** - NOT USED anywhere except comments
2. **Languages config** - Only used in `doctor.ts`, can be auto-generated from plugins
3. **Repo fields** - Many can be auto-detected or have defaults
4. **Package managers** - Can be a simple string instead of object

## Simplified Structure

### Current (61 lines):

```json
{
	"name": "baseline-monorepo",
	"version": "0.1.0",
	"private": true,
	"repos": [
		{
			"name": "core",
			"gitUrl": ".",
			"defaultBranch": "main",
			"path": "packages/core",
			"tags": ["library"],
			"languages": ["node"],
			"library": true
		}
	],
	"languages": {
		"node": {
			"displayName": "Node.js/TypeScript",
			"toolchain": [
				{
					"name": "node",
					"versionPolicy": { "min": "20.0.0" }
				},
				{
					"name": "typescript",
					"versionPolicy": { "min": "5.0.0" }
				}
			]
		}
	},
	"packageManagers": { "default": "pnpm" },
	"github": {
		"provider": "github",
		"useGhCli": true,
		"defaultBaseBranch": "main"
	},
	"editor": ["vscode", "cursor"]
}
```

### Proposed Simplified (15-20 lines):

```json
{
	"repos": ["packages/core", "packages/cli", "packages/gui"],
	"packageManager": "pnpm",
	"editor": ["vscode", "cursor"]
}
```

### With Version Policies (optional):

```json
{
	"repos": [
		"packages/core",
		{
			"name": "my-lib",
			"gitUrl": "https://github.com/user/repo.git",
			"library": true
		}
	],
	"languages": {
		"node": ">=20.0.0",
		"typescript": ">=5.0.0"
	},
	"packageManager": "pnpm",
	"editor": ["vscode", "cursor"]
}
```

**Note:**

- Languages: Just the version string for the language itself (no nested object)
- TypeScript: Optional - only specify if you need a version policy for it
- Repos with `gitUrl` are already external (no need to mark them)

## Key Simplifications

### 1. Repos Can Be Strings

- If it's just a path string, it's a local repo
- Auto-detect name from path
- Auto-detect languages from project files
- Default `defaultBranch` to "main"

### 2. Languages Simplified

- Just version policies: `{ "node": { "node": ">=20.0.0" } }`
- `displayName` comes from plugin metadata
- `toolchain` auto-generated from plugins
- Optional - only needed if version policies required

### 3. Package Manager

- Just a string: `"packageManager": "pnpm"`
- Auto-detect if not specified

### 4. Remove Unused Fields

- `name`, `version`, `private` - not used
- `defaultBranch` in repos - default to "main"
- `github.provider` - redundant (always "github")
- `github.defaultBaseBranch` - default to "main"

### 5. GitHub Config

- Only specify what differs from defaults
- Defaults: `useGhCli: true`, `defaultBaseBranch: "main"`

## Implementation Plan

1. Update `RepoSchema` to support `z.union([z.string(), RepoSchema])`
2. Simplify `LanguageProfileSchema` to just version policies
3. Make `packageManagers` a string instead of object
4. Make `name`, `version`, `private` optional
5. Update `init.ts` to generate simplified config
6. Update `doctor.ts` to auto-generate language profiles from plugins
7. Update all code that reads config to handle simplified format

## Benefits

- **Much simpler** - 15-20 lines instead of 60+
- **Less boilerplate** - auto-detect what we can
- **More intuitive** - strings for simple repos
- **Still flexible** - objects when needed
- **Backward compatible** - can migrate existing configs
