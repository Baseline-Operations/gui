import { useState, useEffect } from "react";

function App() {
	const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);

	useEffect(() => {
		// Load workspace config on mount
		if (window.electronAPI) {
			window.electronAPI.loadConfig().then((result: any) => {
				if (result.success) {
					setWorkspaceRoot(result.workspaceRoot);
				}
			});
		}
	}, []);

	return (
		<div style={{ padding: "20px" }}>
			<h1>Baseline GUI</h1>
			{workspaceRoot ? (
				<p>Workspace: {workspaceRoot}</p>
			) : (
				<p>No workspace found. Initialize a workspace first.</p>
			)}
		</div>
	);
}

export default App;

