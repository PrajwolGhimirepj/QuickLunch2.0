import React, { useEffect, useState } from "react";

const Test = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    let ws;
    let cancelled = false;

    const testWebSocketPort = (port) =>
      new Promise((resolve) => {
        const socket = new WebSocket(`ws://localhost:${port}`);
        const timer = setTimeout(() => {
          socket.close();
          resolve(false);
        }, 800);

        socket.onopen = () => {
          clearTimeout(timer);
          socket.close();
          resolve(true);
        };

        socket.onerror = () => {
          clearTimeout(timer);
          socket.close();
          resolve(false);
        };
      });

    const findWebSocketPort = async (start, end) => {
      for (let port = start; port <= end; port += 1) {
        if (await testWebSocketPort(port)) {
          return port;
        }
      }
      return null;
    };

    const connect = async () => {
      const port = await findWebSocketPort(3002, 3022);
      if (!port || cancelled) {
        console.warn("No WebSocket server available on ports 3002-3022.");
        return;
      }

      ws = new WebSocket(`ws://localhost:${port}`);

      ws.onopen = () =>
        console.log(`WS connected (React comp) on port ${port}`);

      ws.onmessage = (event) => {
        console.log("Raw message:", event.data);
        try {
          const parsed =
            typeof event.data === "string"
              ? JSON.parse(event.data)
              : event.data;
          console.log("Parsed data:", parsed);
          setData(parsed);
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      ws.onclose = () => console.log("WS disconnected");
    };

    connect();

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  return (
    <div>
      <h2>WS Data:</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default Test;
