import net from "net";
import { WebSocketServer } from "ws";

const DEFAULT_PORT = Number(process.env.WS_PORT || 3002);
const MAX_PORT_SEARCH = 20;
const HOST = "127.0.0.1";

function isPortInUse(port, host = HOST) {
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

async function findAvailablePort(
  startPort,
  maxAttempts = MAX_PORT_SEARCH,
  host = HOST,
) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const port = startPort + offset;
    const inUse = await isPortInUse(port, host);
    if (!inUse) {
      return port;
    }
    console.log(`Port ${port} is in use, trying next port...`);
  }
  throw new Error(
    `Could not find an available WebSocket port starting from ${startPort}`,
  );
}

async function startServer() {
  const port = await findAvailablePort(DEFAULT_PORT);
  const wss = new WebSocketServer({ port });
  const clients = new Set();
  let lastMessage = null;

  wss.on("listening", () => {
    console.log(`WS Server running on ws://localhost:${port}`);
  });

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("Client connected");

    if (lastMessage) {
      ws.send(JSON.stringify(lastMessage));
    }

    ws.on("message", (message) => {
      const data = JSON.parse(message.toString());
      console.log("Tabs received:", data);
      lastMessage = data;

      clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify(data));
        }
      });
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      clients.delete(ws);
    });
  });

  wss.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`WebSocket port ${port} is already in use.`);
    } else {
      console.error("WebSocket server error:", error);
    }
    process.exit(1);
  });

  process.on("SIGINT", () => {
    console.log("Shutting down WebSocket server...");
    wss.close(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    console.log("Shutting down WebSocket server...");
    wss.close(() => process.exit(0));
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception in WebSocket server:", error);
    wss.close(() => process.exit(1));
  });
}

startServer().catch((err) => {
  console.error("Failed to start WebSocket server:", err);
  process.exit(1);
});
