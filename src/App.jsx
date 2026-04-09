import { useEffect, useRef, useState } from "react";
import "./App.css";
import SitesGrid from "./Icons/SitesGrid";

const App = () => {
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [size, setSize] = useState({ width: 70, height: 70 });
  const [customSize, setCustomSize] = useState(false);
  const [tempSize, setTempSize] = useState({ width: 70, height: 70 });
  const [opened, setOpened] = useState(false);
  const [customImage, setCustomImage] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const hoverTimeout = useRef(null);

  // Resize observer (Electron)
  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;

        if (window.electronAPI) {
          window.electronAPI.resizeWindow({ width, height });
        }
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Hover enter → OPEN
  const handleMouseEnter = (e) => {
    if (e.target.closest(".dragable")) return;

    clearTimeout(hoverTimeout.current);

    hoverTimeout.current = setTimeout(() => {
      setOpened(true);
    }, 120);
  };

  // Hover leave → CLOSE
  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);

    hoverTimeout.current = setTimeout(() => {
      setOpened(false);
      setCustomSize(false);
    }, 120);
  };

  // 🔥 Right click → open context menu
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // 🔥 Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileURL = URL.createObjectURL(file);
    setCustomImage(fileURL);
    setContextMenu(null);
  };

  // 🔥 Open file picker from context menu
  const handleChangeIcon = () => {
    fileInputRef.current.click();
  };

  const handleChangeSize = () => {
    setCustomSize(true);
    setTempSize({ ...size });
    setContextMenu(null);
  };

  const handleSetSize = () => {
    const width =
      parseInt(document.getElementById("Width").value) || size.width;
    const height =
      parseInt(document.getElementById("Height").value) || size.height;

    if (width > 0 && height > 0) {
      setSize({ width, height });
      setCustomSize(false);
    }
  };

  const handleCloseDialog = () => {
    setCustomSize(false);
  };

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
              <input
                type="number"
                id="Height"
                defaultValue={size.height}
                min="30"
              />
            </div>
            <div className="sizeInput">
              <label>Width</label>
              <input
                type="number"
                id="Width"
                defaultValue={size.width}
                min="30"
              />
            </div>
            <div className="actions">
              <button onClick={handleSetSize} className="font">
                Set
              </button>
              <button onClick={handleCloseDialog} className="font">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="contextMenu font"
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000,
          }}
        >
          <button className="font" onClick={handleChangeIcon}>
            Change Icon
          </button>
          <button className="font" onClick={handleChangeSize}>
            Change Size
          </button>
          <button className="font" onClick={() => setContextMenu(null)}>
            Close
          </button>
        </div>
      )}

      {/* Drag area */}
      <div className="dragable"></div>

      {!opened && (
        <div
          className="initIcon"
          style={{
            width: `${size.width}px`,
            height: `${size.height}px`,
          }}
        >
          <img
            src={
              customImage
                ? customImage
                : "Suspicious Uh Oh GIF by League of Legends.gif"
            }
            alt="App Icon"
          />
        </div>
      )}

      {opened && <SitesGrid close={setOpened} />}
    </div>
  );
};

export default App;
