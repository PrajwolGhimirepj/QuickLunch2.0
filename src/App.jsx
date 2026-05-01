import { useEffect, useRef, useState } from "react";
import "./App.css";
import SitesGrid from "./Icons/SitesGrid";

const STORAGE_KEY_IMAGE = "app_custom_icon";
const STORAGE_KEY_SIZE  = "app_icon_size";

const App = () => {
  const containerRef  = useRef(null);
  const fileInputRef  = useRef(null);
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
  const [opened,       setOpened]       = useState(false);
  const [customImage,  setCustomImage]  = useState(() => {
    // localStorage only stores strings (data-URL / object-URL won't survive sessions,
    // so we store the data-URL instead of an object-URL)
    return localStorage.getItem(STORAGE_KEY_IMAGE) || null;
  });
  const [contextMenu,  setContextMenu]  = useState(null);

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
    // Reset input so the same file can be re-selected later
    e.target.value = "";
  };

  const handleChangeIcon = () => {
    fileInputRef.current.click();
  };

  // ── Clear persisted icon and revert to default ───────────────────────────────
  const handleResetIcon = () => {
    setCustomImage(null);
    localStorage.removeItem(STORAGE_KEY_IMAGE);
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
          <button className="font" onClick={handleChangeSize}>Change Size</button>
          <button className="font" onClick={() => setContextMenu(null)}>Close</button>
        </div>
      )}

      {/* Drag area */}
      <div className="dragable"></div>

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

      {opened && <SitesGrid close={setOpened} />}
    </div>
  );
};

export default App;