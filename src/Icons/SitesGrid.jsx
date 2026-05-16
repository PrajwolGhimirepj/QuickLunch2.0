import React, { useState, useEffect, useRef } from "react";
import "./SitesGrid.css";
import Flower from "./Flower.jpg";

const SitesGrid = ({ close, onConnectionUpdate, backgroundMedia, tabs: tabsFromProps = [], activeTab: activeTabProp = null, sendMessage }) => {
  const [sites, setSites] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sites") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });


  const [initHeight, setInitHeight] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState({ connected: false, attempts: 0, error: null, lastMessage: null, lastUpdated: null });

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const [draggedIndex, setDraggedIndex] = useState(null);

  const openingUrlsRef = useRef(new Set());
  const openTimeoutsRef = useRef({});
  const openedTabsSetRef = useRef(new Set());

  const reportConnection = (updates) => {
    setConnectionStatus((prev) => {
      const next = { ...prev, ...updates };
      if (onConnectionUpdate) onConnectionUpdate(next);
      return next;
    });
  };

  // WebSocket connection is handled at the App level and provided via props.

  // Cleanup any pending open timeouts on unmount
  useEffect(() => {
    return () => {
      try {
        Object.values(openTimeoutsRef.current || {}).forEach((t) => clearTimeout(t));
      } catch (e) {
        // ignore
      }
      openingUrlsRef.current?.clear();
      openTimeoutsRef.current = {};
    };
  }, []);

  // Persist sites to localStorage whenever the list changes
  useEffect(() => {
    localStorage.setItem("sites", JSON.stringify(sites));
  }, [sites]);

  // Keep a quick lookup set of exact tab URLs reported by the extension
  useEffect(() => {
    try {
      openedTabsSetRef.current = new Set((tabsFromProps || []).map((t) => t.url));
    } catch (e) {
      openedTabsSetRef.current = new Set();
    }
  }, [tabsFromProps]);

  // Normalize URL for comparison (hostname + pathname, ignoring query/hash)
  const normalizeUrl = (input) => {
    if (!input) return "";
    try {
      const url = new URL(
        input.startsWith("http") ? input : "https://" + input,
      );
      // Compare hostname + pathname (no query params or hash)
      const normalized = url.hostname + url.pathname;
      return normalized.toLowerCase();
    } catch {
      return input.toLowerCase();
    }
  };

  // Filter invalid Chrome tabs
  const isValidTab = (url) =>
    url && !url.startsWith("chrome://") && !url.startsWith("about:");

  // Check whether a site already exists in the saved list
  const siteExists = (urlToCheck) => {
    const normalized = normalizeUrl(urlToCheck);
    return sites.some((site) => normalizeUrl(site.url) === normalized);
  };

  // Get favicon
  const getFaviconUrl = (siteUrl) => {
    try {
      const hostname = new URL(siteUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch {
      return Flower;
    }
  };

  const renderBackground = () => {
    if (!backgroundMedia || !backgroundMedia.src) {
      return <img src="Untitled-1.png" alt="Background" />;
    }

    const isVideo = backgroundMedia.type?.startsWith("video/");
    return isVideo ? (
      <video
        src={backgroundMedia.src}
        autoPlay
        loop
        muted
        playsInline
      />
    ) : (
      <img src={backgroundMedia.src} alt="Background" />
    );
  };

  // Open or focus site
 const handleOpenSite = (site) => {
  const siteNormalized = normalizeUrl(site.url);

  // Prevent duplicate open attempts for the same URL
  if (openingUrlsRef.current.has(siteNormalized)) {
    console.log(`[handleOpenSite] Already opening ${siteNormalized}, ignoring duplicate click.`);
    return;
  }

  console.log(`[handleOpenSite] Looking for: "${siteNormalized}"`);

  // First prefer strict, letter-to-letter match against tabs reported by extension
  if (openedTabsSetRef.current.has(site.url)) {
    const exactTab = tabsFromProps.find((tab) => tab.url === site.url);
    if (exactTab) {
      console.log(`[handleOpenSite] Exact URL match found (id=${exactTab.id}), focusing...`);
      window.electronAPI?.focusChrome();
      sendMessage?.({ action: "focus-tab", tabId: exactTab.id });
      return;
    }
  }

  const findMatchingTab = () =>
    tabsFromProps.find((tab) => normalizeUrl(tab.url) === siteNormalized);

  const existingTab = findMatchingTab();

  if (existingTab) {
    console.log(`[handleOpenSite] Found matching tab (id=${existingTab.id}), focusing...`);
    window.electronAPI?.focusChrome();
    sendMessage?.({ action: "focus-tab", tabId: existingTab.id });
    return;
  }

  // Mark as opening to debounce repeated clicks
  openingUrlsRef.current.add(siteNormalized);

  // Wait briefly to allow the extension/ws to refresh tabs (race condition fix)
  const timeoutId = setTimeout(() => {
    const rechecked = findMatchingTab();
    if (rechecked) {
      console.log(`[handleOpenSite] Tab appeared after delay (id=${rechecked.id}), focusing...`);
      window.electronAPI?.focusChrome();
      sendMessage?.({ action: "focus-tab", tabId: rechecked.id });
    } else {
      console.log(`[handleOpenSite] No matching tab after delay, opening new window: ${site.url}`);
      window.open(site.url, "_blank");
    }

    // cleanup
    openingUrlsRef.current.delete(siteNormalized);
    delete openTimeoutsRef.current[siteNormalized];
  }, 300);

  openTimeoutsRef.current[siteNormalized] = timeoutId;
};

  // Add manual site
  const addSite = () => {
    if (!url) return;

    const finalUrl = url.startsWith("http") ? url : "https://" + url;

    if (siteExists(finalUrl)) {
      alert("Already saved",finalUrl);
      
      return;
    }

    const newSite = {
      name: name || finalUrl,
      url: finalUrl,
      icon: getFaviconUrl(finalUrl),
    };

    setSites((prev) => [...prev, newSite]);
    setName("");
    setUrl("");
  };

  // Add current tab
  const addCurrentTab = () => {
    if (!activeTabProp || !activeTabProp.url) {
      alert("No active tab found");
      return;
    }

    if (!isValidTab(activeTabProp.url)) return;

    if (siteExists(activeTabProp.url)) {
      alert("Already saved");
      return;
    }

    const newSite = {
      name: activeTabProp.title || activeTabProp.url,
      url: activeTabProp.url,
      icon: getFaviconUrl(activeTabProp.url),
    };

    setSites((prev) => [...prev, newSite]);
  };

  // Delete site
  const deleteSite = (siteUrl) => {
    const normalizedUrl = normalizeUrl(siteUrl);
    setSites((prev) => prev.filter((site) => normalizeUrl(site.url) !== normalizedUrl));
  };

  // Active tab highlight
  const isActiveTab = (site) => {
    return activeTabProp && normalizeUrl(site.url) === normalizeUrl(activeTabProp.url);
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
    
    <div className="container" style={{ height: initHeight || "auto" }} >
      <div className="background">
      <div className="fade"></div>
        {renderBackground()}

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
                deleteSite(site.url);
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
