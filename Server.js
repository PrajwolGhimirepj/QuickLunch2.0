import { WebSocketServer } from "ws";

const port = Number(process.env.WS_PORT || 3002);
const wss = new WebSocketServer({ port });
const clients = new Set();
let lastMessage = null; // Store the latest message

wss.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `WebSocket port ${port} is already in use. Stop the other process or set WS_PORT to a different port.`,
    );
    process.exit(1);
  }
  console.error("WebSocket server error:", error);
});

function shutdown() {
  console.log("Shutting down WebSocket server...");
  wss.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in WebSocket server:", error);
  shutdown();
});

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("Client connected");

  // Send the last message to the newly connected client
  if (lastMessage) {
    ws.send(JSON.stringify(lastMessage));
  }

  ws.on("message", (message) => {
    const data = JSON.parse(message.toString());
    console.log("Tabs received:", data);
    lastMessage = data; // Store it

    clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  });

  ws.on("close", () => {
    console.log(" Client disconnected");
    clients.delete(ws);
  });
});

console.log(` WS Server running on ws://localhost:${port}`);
