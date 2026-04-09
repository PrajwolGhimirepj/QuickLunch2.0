import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 3002 });
const clients = new Set();
let lastMessage = null; // Store the latest message

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

console.log(" WS Server running on ws://localhost:3002");
