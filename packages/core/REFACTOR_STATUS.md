# Command Refactoring Status

## Completed ✅
- `init.ts` - Refactored to `initWorkspace()` with `InitResult`
- `add.ts` - Refactored to `addRepository()` with `AddRepositoryResult`

## Needs Refactoring ❌ (17 commands)

### Git Commands (5)
- `clone.ts` - `cloneCommand()` → `cloneRepositories()` with `CloneResult`
- `sync.ts` - `syncCommand()` → `syncRepositories()` with `SyncResult`
- `status.ts` - `statusCommand()` → `getRepositoryStatus()` with `StatusResult`
- `branch.ts` - `branchCommand()` → `branchRepositories()` with `BranchResult`
- `pr.ts` - `prCreateCommand()` → `createPullRequests()` with `PrResult`

### Exec Commands (6)
- `exec.ts` - `execCommand()` → `executeCommand()` with `ExecResult`
- `test.ts` - `testCommand()` → `runTests()` with `TestResult`
- `lint.ts` - `lintCommand()` → `runLint()` with `LintResult`
- `start.ts` - `startCommand()` → `startApplications()` with `StartResult`
- `watch.ts` - `watchCommand()` → `watchRepositories()` with `WatchResult`
- `docker-compose.ts` - `dockerComposeCommand()` → `dockerCompose()` with `DockerComposeResult`

### Workspace Commands (3)
- `doctor.ts` - `doctorCommand()` → `doctorCheck()` with `DoctorResult`
- `config.ts` - `configCommand()` → `configRepositories()` with `ConfigResult`
- `graph.ts` - `graphCommand()` → `generateGraph()` with `GraphResult`

### Development Commands (2)
- `link.ts` - `linkCommand()` → `linkRepositories()` with `LinkResult`
- `release.ts` - `releaseCommand()` → `releaseVersion()` / `releasePublish()` with `ReleaseResult`

### Plugin Commands (1)
- `plugin.ts` - Multiple commands need refactoring:
  - `pluginInstallCommand()` → `installPlugin()` with `PluginInstallResult`
  - `pluginListCommand()` → `listPlugins()` with `PluginListResult`
  - `pluginRemoveCommand()` → `removePlugin()` with `PluginRemoveResult`
  - `pluginInstallAllCommand()` → `installAllPlugins()` with `PluginInstallAllResult`
  - `pluginSearchCommand()` → `searchPlugins()` with `PluginSearchResult`

## CLI Wrappers Status

### Created ✅
- `init.ts` - Wrapper exists
- `add.ts` - Wrapper exists

### Needed ❌ (17 wrappers)
All other commands need CLI wrappers in `packages/cli/src/commands/`

