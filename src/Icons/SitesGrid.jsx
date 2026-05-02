import React, { useState, useEffect, useRef } from "react";
import "./SitesGrid.css";
import Flower from "./Flower.jpg";

const SitesGrid = ({ close }) => {
  const [sites, setSites] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);

  const [initHeight, setInitHeight] = useState(0);


  const [loaded, setLoaded] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const [draggedIndex, setDraggedIndex] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    const connect = () => {
      console.log("Attempting to connect to WebSocket...");
      wsRef.current = new WebSocket("ws://localhost:3002");

      wsRef.current.onopen = () => {
        console.log("WS connected");
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.tabs) {
          setTabs(data.tabs);
        }

        if (data.activeTab) {
          setActiveTab(data.activeTab);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WS error:", error);
      };

      wsRef.current.onclose = () => {
        console.log("WS disconnected, retrying in 2 seconds...");
        reconnectTimeoutRef.current = setTimeout(connect, 2000);
      };
    };

    // Wait 1 second before initial connection to ensure server is ready
    const initialDelay = setTimeout(connect, 1000);

    return () => {
      clearTimeout(initialDelay);
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  // Load from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("sites") || "[]");
    setSites(saved);
    setLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("sites", JSON.stringify(sites));
    }
  }, [sites, loaded]);


  // Normalize URL
  const normalizeUrl = (input) => {
    if (!input) return "";
    try {
      const url = new URL(
        input.startsWith("http") ? input : "https://" + input,
      );
      return url.hostname;
    } catch {
      return input;
    }
  };

  // Filter invalid Chrome tabs
  const isValidTab = (url) =>
    url && !url.startsWith("chrome://") && !url.startsWith("about:");

  // Get favicon
  const getFaviconUrl = (siteUrl) => {
    try {
      const hostname = new URL(siteUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return Flower;
    }
  };

  // Open or focus site
 const handleOpenSite = (site) => {
  const existingTab = tabs.find(
    (tab) => normalizeUrl(tab.url) === normalizeUrl(site.url),
  );

  if (existingTab) {
    //  Focus Chrome first (ffi-napi is ~5ms, no delay needed)
    window.electronAPI?.focusChrome();

    // Send tab switch immediately after
    wsRef.current?.send(
      JSON.stringify({
        action: "focus-tab",
        tabId: existingTab.id,
      })
    );
  } else {
    window.open(site.url, "_blank");
  }
};

  // Add manual site
  const addSite = () => {
    if (!url) return;

    const finalUrl = url.startsWith("http") ? url : "https://" + url;

    const newSite = {
      name: name || finalUrl,
      url: finalUrl,
      icon: getFaviconUrl(finalUrl),
    };

    setSites((prev) => [...prev, newSite]);

    setShowPopup(false);
    setName("");
    setUrl("");
  };

  // Add current tab
  const addCurrentTab = () => {
    if (!activeTab || !activeTab.url) {
      alert("No active tab found");
      return;
    }

    if (!isValidTab(activeTab.url)) return;

    const exists = sites.some(
      (site) => normalizeUrl(site.url) === normalizeUrl(activeTab.url),
    );

    if (exists) {
      alert("Already saved");
      return;
    }

    const newSite = {
      name: activeTab.title || activeTab.url,
      url: activeTab.url,
      icon: getFaviconUrl(activeTab.url),
    };

    setSites((prev) => [...prev, newSite]);
  };

  // Delete site
  const deleteSite = (index) => setSites(sites.filter((_, i) => i !== index));

  // Active tab highlight
  const isActiveTab = (site) => {
    return activeTab && normalizeUrl(site.url) === normalizeUrl(activeTab.url);
  };

  // Drag handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newSites = [...sites];
    const dragged = newSites[draggedIndex];

    newSites.splice(draggedIndex, 1);
    newSites.splice(dropIndex, 0, dragged);

    setSites(newSites);
    setDraggedIndex(null);
  };

  return (
    <div className="container" style={{ height: initHeight || "auto" }}>
      <div className="background">
        <img src="Untitled-1.png" alt="" />
      </div>

      <div className="grid">
        {sites.map((site, i) => (
          <div
            key={i}
            className={`card-wrapper ${
              draggedIndex === i ? "dragging" : ""
            } ${isActiveTab(site) ? "active-tab" : ""}`}
            draggable
            onDragStart={(e) => handleDragStart(e, i)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, i)}
          >
            <div onClick={() => handleOpenSite(site)}>
              <div className="card">
                <img
                  src={site.icon}
                  alt={site.name}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    if (img.naturalWidth <= 16 || img.naturalHeight <= 16) {
                      img.src = Flower;
                    }
                  }}
                  onError={(e) => (e.currentTarget.src = Flower)}
                />
                <p className="site-name">{site.name}</p>
              </div>
            </div>

            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteSite(i);
              }}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <div className="ActionsContainer">
        <div className="actions">
          <button onClick={addCurrentTab}>+</button>
        </div>
      </div>

 
    </div>
  );
};

export default SitesGrid;
