import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
	// Command execution
	executeCommand: (request: any) => ipcRenderer.invoke("command:execute", request),
	onCommandOutput: (callback: (data: string) => void) => {
		ipcRenderer.on("command:output", (_event, data) => callback(data));
	},
	offCommandOutput: (callback: (data: string) => void) => {
		ipcRenderer.removeListener("command:output", (_event, data) => callback(data));
	},

	// Config management
	loadConfig: () => ipcRenderer.invoke("config:load"),
	saveConfig: (config: any) => ipcRenderer.invoke("config:save", config),
});

