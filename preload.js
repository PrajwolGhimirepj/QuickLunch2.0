import { contextBridge, ipcRenderer } from "electron";

console.log("🧠 PRELOAD LOADED");

contextBridge.exposeInMainWorld("electronAPI", {
  resizeWindow: (size) => ipcRenderer.send("resize-window", size),

  focusChrome: () => ipcRenderer.send("focus-chrome"),

  onDebugSize: (cb) => ipcRenderer.on("debug-size", (_, data) => cb(data)),

  getCurrentTab: () => ipcRenderer.invoke("get-current-tab"),

  // 🔥 Server and environment diagnostics
  getServerStatus: () => ipcRenderer.invoke("get-server-status"),
  getEnvInfo: () => ipcRenderer.invoke("get-env-info"),

  // 🔥 NEW: receive live tab data from extension
  onTabsData: (callback) => {
    ipcRenderer.on("tabs-data", (_, data) => callback(data));
  },

  // 🔥 NEW: manually fetch latest stored data
  getTabsData: () => ipcRenderer.invoke("get-tabs-data"),

  fetchSiteData: async (url) => {
    try {
      const res = await fetch(url);
      const html = await res.text();

      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : "Unknown";

      return {
        title,
        logo: `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`,
      };
    } catch (err) {
      console.error("Fetch failed:", err);
      return {
        title: "Unknown",
        logo: `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`,
      };
    }
  },
});
