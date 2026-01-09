# Baseline Architecture

## High-Level Architecture

Baseline is structured as a modular TypeScript CLI tool following a clean separation of concerns:

```
┌─────────────────────────────────────────┐
│           CLI Entry Point               │
│         (src/cli.ts)                    │
│  Commander.js command registration      │
└──────────────┬──────────────────────────┘
               │
       ┌───────┴────────┐
       │                │
┌──────▼──────┐  ┌──────▼──────┐
│  Commands   │  │   Config    │
│  (src/      │  │  Manager    │
│  commands/) │  │ (src/config)│
└──────┬──────┘  └──────┬──────┘
       │                │
       │         ┌──────▼──────┐
       │         │    Types    │
       │         │  (src/types)│
       │         └──────┬──────┘
       │                │
┌──────▼────────────────▼──────┐
│        Utilities              │
│     (src/utils/)              │
│  - logger.ts                  │
│  - git.ts                     │
│  - package-manager.ts         │
│  - version-check.ts           │
└───────────────────────────────┘
```

## Module Breakdown

### 1. CLI Layer (`src/cli.ts`)
- **Purpose**: Command-line interface entry point
- **Technology**: Commander.js
- **Responsibilities**:
  - Register all commands
  - Parse command-line arguments
  - Route to appropriate command handlers
  - Handle errors and exit codes

### 2. Commands Layer (`src/commands/`)
Each command is a self-contained module:

#### Core Commands
- **`init.ts`**: Interactive workspace setup
  - Uses Enquirer for prompts
  - Generates `baseline.json`
  - Creates workspace files (.gitignore, VS Code/Cursor workspace)

- **`add.ts`**: Add repository to workspace
  - Validates git URL
  - Extracts repo name if not provided
  - Updates `baseline.json`

- **`clone.ts`**: Clone all repositories
  - Checks if repo already exists
  - Uses execa for git clone
  - Parallel-safe (can be enhanced)

- **`sync.ts`**: Sync all repositories
  - Fetches and pulls each repo
  - Skips repos with uncommitted changes
  - Respects default branch

- **`status.ts`**: Show repository status
  - Shows branch, dirty state, ahead/behind
  - Uses git status utilities

- **`exec.ts`**: Execute command across repos
  - Supports filtering (by tag, name)
  - Sequential or parallel execution
  - Fail-fast option

- **`doctor.ts`**: Validate workspace
  - Checks tool versions against policies
  - Validates package manager
  - Checks lockfile consistency
  - Reports actionable issues

#### Stub Commands (Nice-to-Have)
- **`link.ts`**: Workspace linking (not yet implemented)
- **`branch.ts`**: Branch management (partial)
- **`pr.ts`**: PR creation (stub)
- **`release.ts`**: Release management (stub)

### 3. Config Management (`src/config/manager.ts`)
- **Purpose**: Manage `baseline.json` configuration
- **Responsibilities**:
  - Load and validate config using Zod
  - Save config with proper formatting
  - Find workspace root (traverse up directories)
  - Type-safe config access

### 4. Types & Schemas (`src/types/config.ts`)
- **Purpose**: TypeScript types and Zod schemas
- **Key Schemas**:
  - `BaselineConfigSchema`: Root config schema
  - `RepoSchema`: Repository entry schema
  - `LanguageProfileSchema`: Language configuration schema
  - `VersionPolicySchema`: Version constraint schema
  - `PackageManagerConfigSchema`: Package manager config schema
  - `GitHubConfigSchema`: GitHub integration config schema
  - `EditorConfigSchema`: Editor workspace config schema

### 5. Utilities Layer (`src/utils/`)

#### `logger.ts`
- **Purpose**: Consistent logging interface
- **Features**:
  - Color-coded output (using Chalk)
  - Different log levels (info, success, warn, error)
  - Title formatting

#### `git.ts`
- **Purpose**: Git operations abstraction
- **Features**:
  - Check if path is a git repo
  - Get repository status (branch, dirty, ahead/behind)
  - Clone, fetch, pull operations
  - Branch checkout
  - Cross-platform (uses execa)

#### `package-manager.ts`
- **Purpose**: Package manager detection and utilities
- **Features**:
  - Detect package manager from lock files
  - Check if package manager is installed
  - Get package manager version
  - Priority-based detection

#### `version-check.ts`
- **Purpose**: Version policy validation
- **Features**:
  - Semver parsing and comparison
  - Fallback to string comparison for non-semver
  - Supports min/max/exact policies
  - Returns validation result with reason

## Data Flow

### Configuration Flow
```
User Input (init)
    ↓
Enquirer Prompts
    ↓
BaselineConfig Object
    ↓
Zod Validation
    ↓
JSON Serialization
    ↓
baseline.json File
```

### Command Execution Flow
```
CLI Args
    ↓
Commander.js Parsing
    ↓
Command Handler
    ↓
ConfigManager.load()
    ↓
Zod Validation
    ↓
Command Logic
    ↓
Util Functions (git, pm, etc.)
    ↓
Output via Logger
```

### Version Checking Flow
```
doctor command
    ↓
For each language in config
    ↓
For each tool in toolchain
    ↓
execa(tool.detection.command, args)
    ↓
Extract version from stdout
    ↓
VersionCheck.satisfies(version, policy)
    ↓
Report result
```

## Design Decisions

### 1. Zod for Validation
- **Decision**: Use Zod for runtime validation
- **Rationale**: 
  - TypeScript-first approach
  - Runtime validation ensures config integrity
  - Error messages are user-friendly
  - Type inference from schemas

### 2. execa for Command Execution
- **Decision**: Use execa instead of child_process
- **Rationale**:
  - Cross-platform (handles Windows properly)
  - Better error handling
  - Promise-based API
  - Better streaming support

### 3. Enquirer for Prompts
- **Decision**: Use Enquirer instead of Inquirer
- **Rationale**:
  - More modern and maintained
  - Better TypeScript support
  - Smaller bundle size
  - Async/await friendly

### 4. Commander.js for CLI
- **Decision**: Use Commander.js
- **Rationale**:
  - Industry standard
  - Good TypeScript support
  - Automatic help generation
  - Subcommand support

### 5. Separate Commands Directory
- **Decision**: One file per command
- **Rationale**:
  - Clear separation of concerns
  - Easy to find and modify commands
  - Scales well as commands grow
  - Can be tested independently

### 6. Config at Workspace Root
- **Decision**: `baseline.json` at workspace root
- **Rationale**:
  - Simple and discoverable
  - Version control friendly
  - No hidden directories
  - Easy to find and edit

### 7. Version Policies Support Semver and Strings
- **Decision**: Support both semver and string comparison
- **Rationale**:
  - Some tools don't use semver (e.g., Go, Python)
  - Backward compatible
  - Flexible for custom tools
  - Graceful fallback

## Extension Points

### Adding a New Command
1. Create `src/commands/newcommand.ts`
2. Export async function: `export async function newcommandCommand(options?: Options): Promise<void>`
3. Register in `src/cli.ts`
4. Add to README

### Adding a New Language
1. Update `init.ts` to include in language selection
2. Add language profile configuration in init wizard
3. Add detection logic in `doctor.ts` if needed
4. Update README with language support

### Adding a New Package Manager
1. Update `PackageManager` type in `package-manager.ts`
2. Add detection logic in `PackageManagerUtil.detect()`
3. Update config schema if needed
4. Update init wizard

### Adding a New Utility
1. Create `src/utils/newutil.ts`
2. Export reusable functions
3. Import where needed
4. Keep it focused and testable

## Error Handling Strategy

### Command-Level Errors
- Commands catch errors and log via Logger
- Exit with appropriate exit codes (0 = success, 1 = error)
- Provide actionable error messages

### Config Errors
- Zod validation errors are caught and formatted
- Clear error messages about what's wrong with config
- Exit with error code 1

### Git Operation Errors
- execa errors are caught and wrapped
- Include context (which repo, what operation)
- Skip repos that fail (don't stop entire operation)

### Version Check Errors
- Tool not found: Report as error in doctor
- Version parsing fails: Report with original output
- Policy violation: Report with expected vs actual

## Security Considerations

### Current Security Measures
- No code execution from config (commands are static)
- Git operations use execa (no shell injection)
- Config validation prevents malformed data
- No eval or dynamic require

### Future Security Enhancements
- Validate git URLs to prevent malicious repos
- Sanitize command inputs in `exec`
- Rate limiting for API calls (if added)
- Audit dependencies regularly

## Performance Considerations

### Current Optimizations
- Parallel execution option in `exec`
- Config loaded once per command
- Git operations are async

### Future Optimizations
- Cache git status results
- Batch git operations where possible
- Lazy load heavy dependencies
- Progress indicators for long operations

## Testing Strategy (Future)

### Unit Tests
- Test each utility function independently
- Mock external dependencies (execa, file system)
- Test error cases

### Integration Tests
- Test commands end-to-end
- Use temporary directories
- Mock git operations where needed

### E2E Tests
- Test full workflows (init → add → clone → status)
- Test error scenarios
- Test cross-platform compatibility

## Dependencies

### Production Dependencies
- **commander**: CLI framework
- **execa**: Process execution
- **enquirer**: Interactive prompts
- **chalk**: Terminal colors
- **semver**: Version comparison
- **zod**: Runtime validation

### Dev Dependencies
- **typescript**: Type checking and compilation
- **tsx**: TypeScript execution (dev mode)
- **@types/node**: Node.js type definitions

## Build & Distribution

### Build Process
1. `tsc` compiles TypeScript to JavaScript
2. Output to `dist/` directory
3. Package.json points to `dist/cli.js` as binary

### Distribution
- Can be published to npm
- Global install: `npm install -g baseline`
- Local install: `npm install baseline`
- Binary is symlinked to `baseline` command

