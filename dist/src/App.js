import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
function App() {
    const [workspaceRoot, setWorkspaceRoot] = useState(null);
    useEffect(() => {
        // Load workspace config on mount
        if (window.electronAPI) {
            window.electronAPI.loadConfig().then((result) => {
                if (result.success) {
                    setWorkspaceRoot(result.workspaceRoot);
                }
            });
        }
    }, []);
    return (_jsxs("div", { style: { padding: "20px" }, children: [_jsx("h1", { children: "Baseline GUI" }), workspaceRoot ? (_jsxs("p", { children: ["Workspace: ", workspaceRoot] })) : (_jsx("p", { children: "No workspace found. Initialize a workspace first." }))] }));
}
export default App;
