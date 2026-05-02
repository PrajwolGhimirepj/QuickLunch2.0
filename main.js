import { app, BrowserWindow, shell, ipcMain, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import net from "net";
import { WebSocketServer } from "ws";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let win;
let wss;

const isDev = !app.isPackaged;
const SERVER_PORT = process.env.SERVER_PORT || 3000;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const WS_PORT = Number(process.env.WS_PORT || 3002);
const WS_HOST = "127.0.0.1";
const WS_URL = `ws://localhost:${WS_PORT}`;

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
  const pythonCommand = process.platform === "win32" ? "python" : "python3";

  console.log(`Launching Python script with: ${pythonCommand} ${scriptPath}`);
  const pythonProcess = spawn(pythonCommand, [scriptPath], {
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
function isPortInUse(port, host = WS_HOST) {
  return new Promise((resolve) => {
    const socket = net.connect(port, host);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

function startServer() {
  return new Promise(async (resolve, reject) => {
    console.log(`Checking WebSocket port ${WS_PORT}...`);
    const alreadyRunning = await isPortInUse(WS_PORT);
    if (alreadyRunning) {
      console.log(`Detected an existing WebSocket server on port ${WS_PORT}, reusing it.`);
      resolve();
      return;
    }

    console.log(`Starting a new WebSocket server at ${WS_URL}`);

    const clients = new Set();
    let lastMessage = null;

    wss = new WebSocketServer({ port: WS_PORT });

    wss.on("listening", () => {
      console.log(`WS Server running on ws://localhost:${WS_PORT}`);
      resolve();
    });

    wss.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `WebSocket port ${WS_PORT} is already in use. Stop the other process or set WS_PORT to a different port.`,
        );
      } else {
        console.error("WebSocket server error:", error);
      }
      reject(error);
    });

    wss.on("connection", (ws) => {
      clients.add(ws);
      console.log("Client connected");

      if (lastMessage) {
        ws.send(JSON.stringify(lastMessage));
      }

      ws.on("message", (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log("Tabs received:", data);
          lastMessage = data;

          clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        } catch (err) {
          console.error("Invalid WS message:", err);
        }
      });

      ws.on("close", () => {
        clients.delete(ws);
        console.log("Client disconnected");
      });
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
  if (wss) {
    wss.close(() => {
      console.log("WebSocket server stopped");
    });
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