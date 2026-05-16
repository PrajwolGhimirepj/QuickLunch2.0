let socket;
let reconnectTimer;

function connectWS() {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    return;
  }

  socket = new WebSocket("ws://localhost:3002");

  socket.onopen = () => {
    console.log("Connected to server");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    sendAllTabsWithActive();
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
    if (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING) {
      socket.close();
    }
  };

  socket.onclose = () => {
    console.log("Disconnected, retrying...");
    reconnectTimer = setTimeout(connectWS, 2000);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("Received from client:", data);

      // HANDLE FOCUS TAB
      if (data.action === "focus-tab" && data.tabId) {
        chrome.tabs.update(data.tabId, { active: true }, (tab) => {
          if (chrome.runtime.lastError) {
            console.error("Error focusing tab:", chrome.runtime.lastError);
            return;
          }

          console.log("Tab focused:", tab.id);

          // ✅ Bring Chrome window to foreground
          chrome.windows.update(tab.windowId, { focused: true }, () => {
            if (chrome.runtime.lastError) {
              console.error("Error focusing window:", chrome.runtime.lastError);
            } else {
              console.log("Window brought to front:", tab.windowId);
            }
          });
        });
      }
    } catch (err) {
      console.error("Invalid WS message:", err);
    }
  };
}

// Send all tabs and active tab info to the React client
function sendAllTabsWithActive() {
  chrome.tabs.query({}, (tabs) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabArr) => {
      const allTabs = tabs.map((tab) => ({
        title: tab.title,
        url: tab.url,
        id: tab.id,
        windowId: tab.windowId, // ✅ include windowId for future use
      }));

      const activeTab = activeTabArr[0]
        ? {
            title: activeTabArr[0].title,
            url: activeTabArr[0].url,
            id: activeTabArr[0].id,
            windowId: activeTabArr[0].windowId, // ✅ include windowId
          }
        : null;

      const payload = {
        tabs: allTabs,
        activeTab: activeTab,
      };

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
        console.log("Sent:", payload);
      }
    });
  });
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => {
  console.log("Tab changed");
  sendAllTabsWithActive();
});

// Listen for tab updates (URL changes, page load, title changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Send updates on multiple status changes, not just "complete"
  if (changeInfo.status || changeInfo.url || changeInfo.title) {
    console.log("Tab updated:", { tabId, status: changeInfo.status, hasUrl: !!changeInfo.url });
    sendAllTabsWithActive();
  }
});

// Periodic refresh every 2 seconds as a safety net
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    sendAllTabsWithActive();
  }
}, 2000);

chrome.runtime.onStartup.addListener(connectWS);
chrome.runtime.onInstalled.addListener(connectWS);

connectWS();