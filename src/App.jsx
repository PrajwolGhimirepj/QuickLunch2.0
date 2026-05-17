import { useEffect, useRef, useState } from "react";
import "./App.css";
import SitesGrid from "./Icons/SitesGrid";

const STORAGE_KEY_IMAGE = "app_custom_icon";
const STORAGE_KEY_BACKGROUND = "app_custom_background";
const STORAGE_KEY_SIZE  = "app_icon_size";

const App = () => {
  const containerRef  = useRef(null);
  const fileInputRef  = useRef(null);
  const bgInputRef    = useRef(null);
  const hoverTimeout  = useRef(null);

  // Initialise from localStorage so state is already correct on first render
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SIZE);
      return saved ? JSON.parse(saved) : { width: 70, height: 70 };
    } catch {
      return { width: 70, height: 70 };
    }
  });

  const [customSize,   setCustomSize]   = useState(false);
  const [tempSize,     setTempSize]     = useState({ width: 70, height: 70 });
  const [opened,       setOpened]       = useState(true);
  const [customImage,  setCustomImage]  = useState(() => {
    return localStorage.getItem(STORAGE_KEY_IMAGE) || null;
  });
  const [customBg,     setCustomBg]     = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_BACKGROUND) || "null");
    } catch {
      return null;
    }
  });
  const [contextMenu,  setContextMenu]  = useState(null);
  const [debugMenue, SetdebugMenue] = useState(false);
  const [envInfo, setEnvInfo] = useState(null);
  const [serverStatus, setServerStatus] = useState({ started: false, url: "ws://localhost:3002", error: null, message: "unknown" });
  const [wsDebug, setWsDebug] = useState({ connected: false, attempts: 0, error: null, lastMessage: null, lastUpdated: null });
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!window.electronAPI?.getEnvInfo || !window.electronAPI?.getServerStatus) return;

    window.electronAPI
      .getEnvInfo()
      .then((info) => setEnvInfo(info))
      .catch((err) => {
        console.error("Failed to load env info:", err);
      });

    window.electronAPI
      .getServerStatus()
      .then((status) => setServerStatus(status))
      .catch((err) => {
        console.error("Failed to load server status:", err);
        setServerStatus((prev) => ({ ...prev, started: false, error: err.message || String(err) }));
      });
  }, []);

  const updateWsDebug = (updates) => {
    setWsDebug((prev) => ({ ...prev, ...updates }));
  };

  const handleConnectionUpdate = (status) => {
    updateWsDebug(status);
  };

  // Persistent WebSocket connection managed at App level so it survives SitesGrid mount/unmount
  useEffect(() => {
    const connect = () => {
      attemptRef.current += 1;
      updateWsDebug({ connected: false, error: null, attempts: attemptRef.current });

      wsRef.current = new WebSocket("ws://localhost:3002");

      wsRef.current.onopen = () => {
        console.log("WS connected (App)");
        updateWsDebug({ connected: true, error: null });
        try {
          if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: "health-check" }));
        } catch (e) {}
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.tabs) setTabs(data.tabs);
          if (data.activeTab) setActiveTab(data.activeTab);
          updateWsDebug({ lastMessage: data, lastUpdated: new Date().toISOString() });
        } catch (e) {
          console.error("Invalid WS message (App):", e);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("WS error (App):", err);
        updateWsDebug({ connected: false, error: err?.message || "WebSocket error" });
      };

      wsRef.current.onclose = () => {
        console.log("WS disconnected (App), retrying in 2s...");
        updateWsDebug({ connected: false, error: "disconnected" });
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };
    };

    const initialDelay = setTimeout(connect, 1000);

    return () => {
      clearTimeout(initialDelay);
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  const sendMessage = (payload) => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      }
    } catch (e) {
      console.warn("Failed to send WS message:", e);
    }
  };

  // ── Persist size whenever it changes ────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify(size));
  }, [size]);

  // ── Resize observer (Electron) ───────────────────────────────────────────────
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (window.electronAPI) {
          window.electronAPI.resizeWindow({ width, height });
        }
      }
    });

    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => {
      if (containerRef.current) resizeObserver.unobserve(containerRef.current);
    };
  }, []);

  // ── Close context menu on outside click ─────────────────────────────────────
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // ── Hover handlers ──────────────────────────────────────────────────────────
  const handleMouseEnter = (e) => {
    if (e.target.closest(".dragable")) return;
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setOpened(true), 120);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => {
      setOpened(false);
      setCustomSize(false);
    }, 120);
  };

  // ── Context menu ────────────────────────────────────────────────────────────
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // ── File picker: read as data-URL so it survives sessions ───────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataURL = event.target.result;
      setCustomImage(dataURL);
      localStorage.setItem(STORAGE_KEY_IMAGE, dataURL);
    };
    reader.readAsDataURL(file);

    setContextMenu(null);
    e.target.value = "";
  };

  const handleChangeIcon = () => {
    fileInputRef.current.click();
  };

  const handleBackgroundFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataURL = event.target.result;
      const bgPayload = {
        src: dataURL,
        type: file.type || "image/*",
      };
      setCustomBg(bgPayload);
      localStorage.setItem(STORAGE_KEY_BACKGROUND, JSON.stringify(bgPayload));
    };
    reader.readAsDataURL(file);

    setContextMenu(null);
    e.target.value = "";
  };

  const handleChangeBackground = () => {
    bgInputRef.current.click();
  };

  // ── Clear persisted icon and revert to default ───────────────────────────────
  const handleResetIcon = () => {
    setCustomImage(null);
    localStorage.removeItem(STORAGE_KEY_IMAGE);
    setContextMenu(null);
  };

  const handleResetBackground = () => {
    setCustomBg(null);
    localStorage.removeItem(STORAGE_KEY_BACKGROUND);
    setContextMenu(null);
  };

  const handleChangeSize = () => {
    setCustomSize(true);
    setTempSize({ ...size });
    setContextMenu(null);
  };

  const handleSetSize = () => {
    const width  = parseInt(document.getElementById("Width").value)  || size.width;
    const height = parseInt(document.getElementById("Height").value) || size.height;

    if (width > 0 && height > 0) {
      setSize({ width, height }); // useEffect above persists this
      setCustomSize(false);
    }
  };

  const handleCloseDialog = () => setCustomSize(false);

  const handelDebugMenue =()=>{
    SetdebugMenue(!debugMenue);
  }

  return (
    <div
      ref={containerRef}
      className="Container font"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*,image/gif"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <input
        type="file"
        accept="image/*,video/*"
        ref={bgInputRef}
        style={{ display: "none" }}
        onChange={handleBackgroundFileChange}
      />

      {/* Custom Size Dialog */}
      {customSize && (
        <div className="customSizeDialog">
          <div className="customSizeContainer">
            <h3>Custom Size</h3>
            <div className="sizeInput">
              <label>Height</label>
              <input type="number" id="Height" defaultValue={size.height} min="30" />
            </div>
            <div className="sizeInput">
              <label>Width</label>
              <input type="number" id="Width" defaultValue={size.width} min="30" />
            </div>
            <div className="actions">
              <button onClick={handleSetSize}    className="font">Set</button>
              <button onClick={handleCloseDialog} className="font">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="contextMenu font"
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
        >
          <button className="font" onClick={handleChangeIcon}>Change Icon</button>
          {customImage && (
            <button className="font" onClick={handleResetIcon}>Reset Icon</button>
          )}
          <button className="font" onClick={handleChangeBackground}>Set Background</button>
          {customBg && (
            <button className="font" onClick={handleResetBackground}>Reset Background</button>
          )}
          <button
            className="font"
            onClick={() => {
              handelDebugMenue();
              setContextMenu(null);
            }}
          >
            {debugMenue ? "Hide Debug" : "Show Debug"}
          </button>
          <button className="font" onClick={handleChangeSize}>Change Size</button>
          <button className="font" onClick={() => setContextMenu(null)}>Close</button>
        </div>
      )}

      {debugMenue && (
        <div className="debugcontainer">
          <div style={{ padding: 12, fontSize: 12, color: "#111" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <strong>Connection Debug</strong>
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                status: {serverStatus.started ? "true" : "false"}
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <div>
                <strong>Electron env:</strong> {envInfo ? envInfo.isDev ? "dev" : "prod" : "loading..."}
              </div>
              <div>
                <strong>Server URL:</strong> {serverStatus.url}
              </div>
              <div>
                <strong>Server state:</strong> {serverStatus.message || "starting"}
              </div>
              {serverStatus.error && (
                <div style={{ color: "#a00" }}>
                  <strong>Error:</strong> {serverStatus.error}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <strong>WS connected:</strong> {wsDebug.connected ? "true" : "false"}
              </div>
              <div>
                <strong>Reconnect attempts:</strong> {wsDebug.attempts}
              </div>
              {wsDebug.error && (
                <div style={{ color: "#a00" }}>
                  <strong>WS error:</strong> {wsDebug.error}
                </div>
              )}
              {wsDebug.lastUpdated && (
                <div>
                  <strong>Last message:</strong> {wsDebug.lastUpdated}
                </div>
              )}
              {wsDebug.lastMessage && (
                <details style={{ marginTop: 10 }}>
                  <summary>Latest received payload</summary>
                  <pre style={{ whiteSpace: "pre-wrap", fontSize: 11, maxHeight: 120, overflow: "auto" }}>
                    {JSON.stringify(wsDebug.lastMessage, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Drag area */}
  

      {!opened && (
        <div
          className="initIcon"
          style={{ width: `${size.width}px`, height: `${size.height}px` }}
        >
          <img
            src={customImage ?? "League Of Legends Jinx GIF.gif"}
            alt="App Icon"
          />
        </div>
      )}
     <div className="dragable"></div>

   {opened && (
  <>
    
    <SitesGrid
      close={setOpened}
      onConnectionUpdate={handleConnectionUpdate}
      backgroundMedia={customBg}
      tabs={tabs}
      activeTab={activeTab}
      sendMessage={sendMessage}
    />
  </>
)}
    </div>
  );
};

export default App;