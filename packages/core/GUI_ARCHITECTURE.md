# Baseline GUI Architecture Plan

## Overview

This document outlines the architecture for a cross-platform GUI application that provides a visual interface for all baseline CLI commands. The GUI will be built using modern web technologies with cross-platform desktop support.

## Technology Stack Recommendation

### Primary Recommendation: **Electron + React + TypeScript**

**Why Electron?**

- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Mature ecosystem with excellent tooling
- ✅ Can reuse existing Node.js codebase
- ✅ Native OS integration capabilities
- ✅ Large community and extensive documentation
- ✅ Can bundle the CLI as a dependency

**Why React?**

- ✅ Component-based architecture for reusable UI elements
- ✅ Large ecosystem of UI libraries (Material-UI, Ant Design, Chakra UI)
- ✅ Excellent TypeScript support
- ✅ Strong developer experience
- ✅ Easy to maintain and extend

**Alternative Consideration: Tauri**

- ✅ Smaller bundle size
- ✅ Better performance (uses system webview)
- ✅ More secure by default
- ⚠️ Less mature ecosystem
- ⚠️ More complex setup

**Recommendation: Start with Electron, consider Tauri migration later if bundle size becomes an issue.**

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GUI Application Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   React UI   │  │  State Mgmt  │  │   Routing    │     │
│  │  Components  │  │  (Zustand)   │  │  (React      │     │
│  │              │  │              │  │   Router)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Command Bridge Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   IPC Layer  │  │  CLI Adapter │  │  Event Bus   │     │
│  │  (Electron)  │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Baseline CLI Core (Existing)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Commands   │  │   Config     │  │   Plugins    │     │
│  │              │  │   Manager    │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Project Structure

```
baseline-gui/
├── package.json
├── electron/
│   ├── main.ts                 # Electron main process
│   ├── preload.ts              # Preload script for security
│   └── ipc/                    # IPC handlers
│       ├── commands.ts          # Command execution handlers
│       ├── config.ts           # Config read/write handlers
│       └── events.ts           # Event emitters
├── src/                        # React application
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root component
│   ├── components/             # Shared components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Layout.tsx
│   │   └── workspace/
│   │       ├── RepoList.tsx
│   │       ├── RepoCard.tsx
│   │       └── RepoStatus.tsx
│   ├── pages/                  # Page components
│   │   ├── Dashboard.tsx       # Main dashboard
│   │   ├── Workspace/
│   │   │   ├── Init.tsx
│   │   │   ├── AddRepo.tsx
│   │   │   ├── Config.tsx
│   │   │   └── Doctor.tsx
│   │   ├── Git/
│   │   │   ├── Clone.tsx
│   │   │   ├── Sync.tsx
│   │   │   ├── Status.tsx
│   │   │   ├── Branch.tsx
│   │   │   └── PR.tsx
│   │   ├── Execution/
│   │   │   ├── Exec.tsx
│   │   │   ├── Test.tsx
│   │   │   ├── Lint.tsx
│   │   │   ├── Start.tsx
│   │   │   └── Watch.tsx
│   │   ├── Development/
│   │   │   ├── Link.tsx
│   │   │   └── Release.tsx
│   │   └── Plugins/
│   │       ├── List.tsx
│   │       ├── Install.tsx
│   │       └── Search.tsx
│   ├── hooks/                  # Custom React hooks
│   │   ├── useBaselineCommand.ts
│   │   ├── useWorkspace.ts
│   │   ├── useRepos.ts
│   │   └── useConfig.ts
│   ├── store/                  # State management (Zustand)
│   │   ├── workspaceStore.ts
│   │   ├── repoStore.ts
│   │   ├── commandStore.ts
│   │   └── configStore.ts
│   ├── services/               # Service layer
│   │   ├── commandService.ts   # Command execution service
│   │   ├── configService.ts    # Config management service
│   │   └── eventService.ts     # Event handling service
│   ├── utils/                  # Utility functions
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── constants.ts
│   └── types/                  # TypeScript types
│       ├── command.ts
│       ├── workspace.ts
│       └── config.ts
├── public/                     # Static assets
└── build/                      # Build output
```

## Core Components Design

### 1. Command Execution System

**Design Pattern: Command Pattern with IPC Bridge**

```typescript
// src/services/commandService.ts
interface CommandRequest {
	command: string;
	args?: string[];
	options?: Record<string, any>;
	workspaceRoot?: string;
}

interface CommandResponse {
	success: boolean;
	output?: string;
	error?: string;
	exitCode?: number;
}

class CommandService {
	async execute(request: CommandRequest): Promise<CommandResponse> {
		// Send IPC message to Electron main process
		// Main process executes CLI command
		// Return results via IPC
	}

	async stream(request: CommandRequest): Promise<ReadableStream> {
		// Stream command output in real-time
	}
}
```

**Electron IPC Handler:**

```typescript
// electron/ipc/commands.ts
ipcMain.handle("command:execute", async (event, request) => {
	const { execa } = require("execa");
	const { join } = require("path");

	// Execute baseline CLI command
	const result = await execa(
		"baseline",
		[request.command, ...request.args],
		{
			cwd: request.workspaceRoot || process.cwd(),
			...request.options,
		}
	);

	return {
		success: true,
		output: result.stdout,
		exitCode: result.exitCode,
	};
});
```

### 2. Shared Component Library

**Component Categories:**

1. **Form Components**

    - `TextInput` - Text input with validation
    - `Select` - Dropdown with search
    - `MultiSelect` - Multi-select dropdown
    - `Checkbox` - Checkbox with label
    - `RadioGroup` - Radio button group
    - `FilePicker` - File/directory picker
    - `FormField` - Wrapper with label and error

2. **Display Components**

    - `Card` - Container card
    - `Table` - Data table with sorting/filtering
    - `List` - List with items
    - `Badge` - Status badge
    - `Tag` - Tag component
    - `CodeBlock` - Syntax-highlighted code
    - `LogViewer` - Scrollable log output

3. **Action Components**

    - `Button` - Button with variants (primary, secondary, danger)
    - `IconButton` - Icon-only button
    - `ButtonGroup` - Button group
    - `Dropdown` - Dropdown menu
    - `ContextMenu` - Right-click menu

4. **Feedback Components**

    - `Toast` - Toast notifications
    - `Modal` - Modal dialog
    - `Alert` - Alert message
    - `Spinner` - Loading spinner
    - `ProgressBar` - Progress indicator
    - `Skeleton` - Loading skeleton

5. **Layout Components**
    - `Sidebar` - Navigation sidebar
    - `Header` - App header
    - `Footer` - App footer
    - `Container` - Page container
    - `Grid` - Grid layout
    - `Stack` - Stack layout

### 3. Page-Specific Components

Each command gets its own page component with:

1. **Form/Input Section** - Command-specific inputs
2. **Action Section** - Execute button and options
3. **Output Section** - Real-time command output
4. **Results Section** - Formatted results display

**Example: Clone Page**

```typescript
// src/pages/Git/Clone.tsx
export function ClonePage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string>('');

  const handleClone = async () => {
    setLoading(true);
    const result = await commandService.execute({
      command: 'clone',
      workspaceRoot: workspaceStore.root
    });
    setOutput(result.output || '');
    setLoading(false);
  };

  return (
    <Container>
      <Card>
        <CardHeader>
          <h2>Clone Repositories</h2>
        </CardHeader>
        <CardBody>
          <RepoList repos={repos} />
          <Stack direction="row" spacing={2}>
            <Button onClick={handleClone} loading={loading}>
              Clone All
            </Button>
            <Button variant="secondary">Select Repos</Button>
          </Stack>
        </CardBody>
        {output && (
          <CardFooter>
            <LogViewer content={output} />
          </CardFooter>
        )}
      </Card>
    </Container>
  );
}
```

## State Management

**Using Zustand for lightweight state management:**

```typescript
// src/store/workspaceStore.ts
import create from "zustand";

interface WorkspaceState {
	root: string | null;
	config: BaselineConfig | null;
	loading: boolean;
	setRoot: (root: string) => void;
	loadConfig: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
	root: null,
	config: null,
	loading: false,
	setRoot: (root) => set({ root }),
	loadConfig: async () => {
		set({ loading: true });
		const config = await configService.load();
		set({ config, loading: false });
	},
}));
```

## Routing

**Using React Router for navigation:**

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Sidebar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workspace/init" element={<InitPage />} />
          <Route path="/workspace/add" element={<AddRepoPage />} />
          <Route path="/git/clone" element={<ClonePage />} />
          <Route path="/git/sync" element={<SyncPage />} />
          {/* ... more routes */}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
```

## Real-Time Updates

**Using Electron IPC for real-time command output:**

```typescript
// Electron main process
const childProcess = execa('baseline', ['watch'], {
  cwd: workspaceRoot
});

childProcess.stdout.on('data', (data) => {
  mainWindow.webContents.send('command:output', data.toString());
});

childProcess.on('close', (code) => {
  mainWindow.webContents.send('command:complete', code);
```

```typescript
// React component
useEffect(() => {
	const handleOutput = (data: string) => {
		setOutput((prev) => prev + data);
	};

	window.electronAPI.onCommandOutput(handleOutput);
	return () => {
		window.electronAPI.offCommandOutput(handleOutput);
	};
}, []);
```

## UI Library Recommendation

**Recommended: Chakra UI or Ant Design**

**Chakra UI:**

- ✅ Modern, accessible components
- ✅ Excellent TypeScript support
- ✅ Easy theming
- ✅ Good documentation
- ✅ Lightweight

**Ant Design:**

- ✅ Enterprise-grade components
- ✅ More components out of the box
- ✅ Better for complex data tables
- ⚠️ Larger bundle size
- ⚠️ More opinionated styling

**Recommendation: Start with Chakra UI for faster development, migrate to Ant Design if complex tables/forms are needed.**

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

- [ ] Set up Electron + React + TypeScript project
- [ ] Create basic layout (Sidebar, Header, Footer)
- [ ] Implement IPC bridge for command execution
- [ ] Create shared component library foundation
- [ ] Set up routing and state management

### Phase 2: Core Commands (Week 3-4)

- [ ] Dashboard page with workspace overview
- [ ] Workspace management pages (Init, Add, Config, Doctor)
- [ ] Git operations pages (Clone, Sync, Status)
- [ ] Basic command execution with output display

### Phase 3: Advanced Features (Week 5-6)

- [ ] Execution commands (Test, Lint, Start, Watch)
- [ ] Development tools (Link, Release)
- [ ] Plugin management pages
- [ ] Real-time output streaming
- [ ] Progress indicators

### Phase 4: Polish (Week 7-8)

- [ ] Error handling and validation
- [ ] Loading states and skeletons
- [ ] Toast notifications
- [ ] Settings/preferences page
- [ ] Keyboard shortcuts
- [ ] Dark mode support

## Key Design Principles

1. **Component Reusability**: All UI elements should be reusable components
2. **Type Safety**: Full TypeScript coverage
3. **Error Handling**: Graceful error handling with user-friendly messages
4. **Performance**: Lazy loading for routes, virtual scrolling for large lists
5. **Accessibility**: WCAG 2.1 AA compliance
6. **Responsive**: Works on different window sizes
7. **Extensibility**: Easy to add new commands/pages

## Integration with Existing CLI

The GUI will:

1. **Bundle the CLI** as a dependency
2. **Execute commands** via child processes
3. **Parse output** for structured display
4. **Read/write config** files directly
5. **Monitor file changes** for real-time updates

## Security Considerations

1. **IPC Security**: Use context isolation and preload scripts
2. **Command Validation**: Validate all command inputs
3. **Path Sanitization**: Sanitize file paths
4. **Sandboxing**: Enable Electron sandbox where possible
5. **Code Signing**: Sign application for distribution

## Distribution

- **macOS**: DMG with code signing
- **Windows**: NSIS installer with code signing
- **Linux**: AppImage or .deb/.rpm packages

Use **electron-builder** for automated builds and distribution.

## Future Enhancements

1. **Plugin System**: Allow GUI plugins/extensions
2. **Themes**: Customizable themes
3. **Workspace Templates**: Pre-configured workspace templates
4. **Command History**: View and replay command history
5. **Multi-workspace**: Manage multiple workspaces
6. **Collaboration**: Share workspace configs
7. **Analytics**: Usage analytics (opt-in)
