import React, { useEffect, useState } from "react";

const Test = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3002");

    ws.onopen = () => console.log(" WS connected  React comp");

    ws.onmessage = (event) => {
      console.log("Raw message:", event.data);
      try {
        const parsed =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        console.log("Parsed data:", parsed);
        setData(parsed);
      } catch (err) {
        console.error("WS parse error:", err);
      }
    };

    ws.onclose = () => console.log("WS disconnected");

    return () => ws.close();
  }, []);

  return (
    <div>
      <h2>WS Data:</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default Test;
