import { app, BrowserWindow } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let mainWindow = null;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, "preload.js"),
        },
    });
    // Load the app
    if (process.env.NODE_ENV === "development") {
        mainWindow.loadURL("http://localhost:3000");
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(join(__dirname, "../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
// IPC handlers will be added here
// Import command handlers from separate files
import "./ipc/commands.js";
