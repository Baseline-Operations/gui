/// <reference types="vite/client" />

interface ElectronAPI {
	executeCommand: (request: any) => Promise<any>;
	onCommandOutput: (callback: (data: string) => void) => void;
	offCommandOutput: (callback: (data: string) => void) => void;
	loadConfig: () => Promise<any>;
	saveConfig: (config: any) => Promise<any>;
}

interface Window {
	electronAPI: ElectronAPI;
}

