import { app, BrowserWindow, shell, ipcMain, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, exec } from "child_process";
import { Script } from "vm";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;
let serverProcess;

const isDev = !app.isPackaged;
const SERVER_PORT = process.env.SERVER_PORT || 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// 🔥 SINGLE INSTANCE LOCK
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function focusChromeWindow() {
  if (win) win.setAlwaysOnTop(false);

  const scriptPath = path.join(__dirname, "Script/Focus.py");

  const pythonProcess = spawn("python", [scriptPath], {
    stdio: "inherit",
  });

  pythonProcess.on("error", (err) => {
    console.error("Failed to run Python script:", err);
    // Restore always on top even if script failed
    if (win) win.setAlwaysOnTop(true);
  });

  pythonProcess.on("exit", (code) => {
    console.log(`Python script exited with code ${code}`);
    // Restore always on top after Chrome has been focused
    if (win) win.setAlwaysOnTop(true);
  });
}
// Start Node server
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, "Server.js");
    console.log(`Starting server from: ${serverPath}`);

    serverProcess = spawn(process.execPath, [serverPath], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: isDev ? "development" : "production",
        SERVER_PORT: SERVER_PORT,
      },
    });

    serverProcess.on("error", (err) => {
      console.error("Failed to start server process:", err);
      reject(err);
    });

    serverProcess.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        console.error(`Server process exited with code ${code}`);
      }
    });

    if (serverProcess.stdout) {
      serverProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[Server] ${output}`);
        if (
          output.includes("listening") ||
          output.includes("started") ||
          output.includes("Server running")
        ) {
          resolve();
        }
      });
    }

    if (serverProcess.stderr) {
      serverProcess.stderr.on("data", (data) => {
        console.error(`[Server Error] ${data.toString()}`);
      });
    }

    const timeout = setTimeout(() => {
      console.log("Server startup timeout - proceeding anyway");
      resolve();
    }, 5000);

    serverProcess.on("message", (msg) => {
      if (msg === "ready") {
        clearTimeout(timeout);
        console.log("Server signaled ready");
        resolve();
      }
    });
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setIcon(path.join(__dirname, "assets/AppIcon.ico"));
  console.log("Window created");

  const url = isDev
    ? "http://localhost:5173"
    : "https://quicklubch.netlify.app/";
  console.log(`Loading URL: ${url}`);

  win.loadURL(url).catch((err) => {
    console.error("Failed to load URL:", err);
    setTimeout(() => {
      win.loadURL(url).catch((retryErr) => {
        console.error("Failed to load URL on retry:", retryErr);
      });
    }, 2000);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.on("closed", () => {
    win = null;
  });
}

app.whenReady().then(async () => {
  console.log("App is ready");
  console.log(`Environment: ${isDev ? "development" : "production"}`);

  try {
    console.log("Starting server...");
    await startServer();
    console.log("Server started successfully");
    createWindow();
  } catch (err) {
    console.error("Failed to start application:", err);
    app.quit();
  }
});

app.on("will-quit", () => {
  console.log("App is quitting, cleaning up...");
  if (serverProcess) {
    serverProcess.kill();
    console.log("Server stopped");
  }
});



// ================= IPC HANDLERS =================

ipcMain.on("focus-chrome", () => {
  console.log("focus-chrome IPC received");
  focusChromeWindow();
});

ipcMain.on("resize-window", (event, payload) => {
  if (!win || !payload?.width || !payload?.height) {
    console.warn("Invalid resize window payload:", payload);
    return;
  }

  const w = Math.ceil(payload.width);
  const h = Math.ceil(payload.height);

  const display = screen.getDisplayNearestPoint(win.getBounds());
  const { width: screenW, height: screenH } = display.workAreaSize;

  const margin = 10;
  const x = screenW - w - margin;
  const y = screenH - h - margin;

  console.log(`Resizing window to: ${w}x${h} at position (${x}, ${y})`);
  win.setBounds({ width: w, height: h, x, y });
});

ipcMain.handle("get-server-url", () => SERVER_URL);

ipcMain.handle("get-env-info", () => ({
  isDev,
  serverPort: SERVER_PORT,
  serverUrl: SERVER_URL,
  platform: process.platform,
  arch: process.arch,
}));

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (win === null) createWindow();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});