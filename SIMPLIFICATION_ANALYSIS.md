# Configuration Simplification Analysis

## Current Issues

Looking at the current `baseline.json`, many fields are redundant or can be auto-detected:

1. **Languages Config** - Overly complex

    - `displayName` is redundant (plugin metadata has it)
    - Full `toolchain` array is redundant (plugins provide it)
    - We only need version policies when specified

2. **Repo Fields** - Many can be auto-detected

    - `defaultBranch` - defaults to "main", rarely needed
    - `languages` - can be auto-detected from project files
    - `tags` - optional metadata, can be inferred
    - `path` - can default to `name` if not provided

3. **Root Fields** - Questionable necessity

    - `name`, `version`, `private` - feel like package.json fields
    - Not actually used anywhere critical in the code

4. **GitHub Config** - Mostly defaults

    - `provider: "github"` - redundant
    - `useGhCli: true` - reasonable default
    - `defaultBaseBranch: "main"` - already defaults

5. **Package Managers** - Can be auto-detected
    - Only need `default` if user wants to override auto-detection

## Proposed Simplified Structure

```json
{
	"repos": [
		{
			"name": "core",
			"gitUrl": ".",
			"path": "packages/core",
			"library": true
		},
		"packages/cli",
		{
			"name": "cli",
			"repository": {
				"provider": "github",
				"owner": "user",
				"name": "repo"
			}
		}
	],
	"languages": {
		"node": {
			"node": ">=20.0.0",
			"typescript": ">=5.0.0"
		}
	},
	"packageManager": "pnpm",
	"github": {
		"useGhCli": true
	},
	"editor": ["vscode", "cursor"]
}
```

### Key Simplifications:

1. **Repos can be strings** - Just the path if it's local
2. **Languages simplified** - Just version policies, plugin provides the rest
3. **Package manager** - Single string instead of object
4. **Remove redundant fields** - `name`, `version`, `private`, `defaultBranch`, etc.
5. **GitHub config** - Only specify what differs from defaults

## Even Simpler Alternative

```json
{
	"repos": [
		"packages/core",
		"packages/cli",
		{
			"name": "external",
			"gitUrl": "https://github.com/user/repo.git"
		}
	],
	"packageManager": "pnpm",
	"editor": ["vscode", "cursor"]
}
```

- Languages auto-detected from repos
- Version policies only when needed (could be in separate file or per-repo)
- GitHub settings only when needed
