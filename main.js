import { app, BrowserWindow, shell, ipcMain, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { exec } from "child_process";

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
    // If someone tries to open a second instance, focus the existing window
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// 🔥 Start your Node server with proper error handling
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

    serverProcess.on("exit", (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`Server process exited with code ${code}`);
      }
    });

    // Listen for 'ready' message from Server.js
    if (serverProcess.stdout) {
      serverProcess.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`[Server] ${output}`);

        // Check if server is ready (customize based on your Server.js output)
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

    // Fallback timeout - resolve after 5 seconds anyway
    const timeout = setTimeout(() => {
      console.log("Server startup timeout - proceeding anyway");
      resolve();
    }, 5000);

    // Clear timeout if server sends ready message
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

  console.log("Window created");

  // Load URL based on environment
  let url;
  if (isDev) {
    url = "http://localhost:5173"; // Vite dev server
  } else {
    url = "https://quicklubch.netlify.app/"; // Production Netlify
  }

  console.log(`Loading URL: ${url}`);

  win.loadURL(url).catch((err) => {
    console.error("Failed to load URL:", err);
    // Retry loading after a delay
    setTimeout(() => {
      win.loadURL(url).catch((retryErr) => {
        console.error("Failed to load URL on retry:", retryErr);
      });
    }, 2000);
  });

  // Open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Handle window closed
  win.on("closed", () => {
    win = null;
  });

  // Open DevTools in development
  // if (isDev) {
  //   win.webContents.openDevTools();
  // }
}

app.whenReady().then(async () => {
  console.log("App is ready");
  console.log(`Environment: ${isDev ? "development" : "production"}`);

  try {
    // Start server and wait for it to be ready
    console.log("Starting server...");
    await startServer();
    console.log("Server started successfully");

    // Create window after server is ready
    createWindow();
  } catch (err) {
    console.error("Failed to start application:", err);
    app.quit();
  }
});

// 🔥 Kill server on exit
app.on("will-quit", () => {
  console.log("App is quitting, cleaning up...");

  if (serverProcess) {
    console.log("Killing server process...");
    serverProcess.kill();
    console.log("Server stopped");
  }
});

// ================= IPC HANDLERS =================

// Focus Chrome
ipcMain.on("focus-chrome", () => {
  console.log("Attempting to focus Chrome...");

  const psCommand = `powershell -Command "
    $proc = Get-Process chrome -ErrorAction SilentlyContinue;
    if ($proc -and $proc.MainWindowHandle) {
      Add-Type @'
        using System;
        using System.Runtime.InteropServices;
        public class WinAPI {
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
        }
'@;
      [WinAPI]::SetForegroundWindow($proc.MainWindowHandle);
    }
  "`;

  exec(psCommand, (err) => {
    if (err) {
      console.log("Failed to focus Chrome:", err);
    } else {
      console.log("Chrome focused successfully");
    }
  });
});

// Resize window
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

// Get server URL (useful for renderer process)
ipcMain.handle("get-server-url", () => {
  return SERVER_URL;
});

// Get environment info
ipcMain.handle("get-env-info", () => {
  return {
    isDev,
    serverPort: SERVER_PORT,
    serverUrl: SERVER_URL,
    platform: process.platform,
    arch: process.arch,
  };
});

// macOS behavior
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Handle app activation (macOS)
app.on("activate", () => {
  if (win === null) {
    createWindow();
  }
});

// Handle any uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});
