let socket;
let reconnectTimer;

const WS_PORT_START = 3002;
const WS_PORT_END = 3022;

const testWebSocketPort = (port) =>
  new Promise((resolve) => {
    const candidate = new WebSocket(`ws://localhost:${port}`);
    const timer = setTimeout(() => {
      candidate.close();
      resolve(false);
    }, 800);

    candidate.onopen = () => {
      clearTimeout(timer);
      candidate.close();
      resolve(true);
    };

    candidate.onerror = () => {
      clearTimeout(timer);
      candidate.close();
      resolve(false);
    };
  });

function connectWS() {
  if (socket && socket.readyState !== WebSocket.CLOSED) {
    return;
  }

  const connectToAvailablePort = async () => {
    for (let port = WS_PORT_START; port <= WS_PORT_END; port += 1) {
      const available = await testWebSocketPort(port);
      if (!available) continue;

      socket = new WebSocket(`ws://localhost:${port}`);

      socket.onopen = () => {
        console.log(`Connected to server on port ${port}`);
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        sendAllTabsWithActive();
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (
          socket.readyState !== WebSocket.OPEN &&
          socket.readyState !== WebSocket.CONNECTING
        ) {
          socket.close();
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received from client:", data);

          if (data.action === "focus-tab" && data.tabId) {
            chrome.tabs.update(data.tabId, { active: true }, (tab) => {
              if (chrome.runtime.lastError) {
                console.error("Error focusing tab:", chrome.runtime.lastError);
                return;
              }

              console.log("Tab focused:", tab.id);

              chrome.windows.update(tab.windowId, { focused: true }, () => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "Error focusing window:",
                    chrome.runtime.lastError,
                  );
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

      socket.onclose = () => {
        console.log("Disconnected, retrying...");
        reconnectTimer = setTimeout(connectWS, 2000);
      };

      return;
    }

    console.warn(
      `No WebSocket server found between ports ${WS_PORT_START}-${WS_PORT_END}`,
    );
  };

  connectToAvailablePort();
}

// Send all tabs and active tab info to the React client
function sendAllTabsWithActive() {
  chrome.tabs.query({}, (tabs) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (activeTabArr) => {
      const allTabs = tabs.map((tab) => ({
        title: tab.title,
        url: tab.url,
        id: tab.id,
        windowId: tab.windowId, //
      }));

      const activeTab = activeTabArr[0]
        ? {
            title: activeTabArr[0].title,
            url: activeTabArr[0].url,
            id: activeTabArr[0].id,
            windowId: activeTabArr[0].windowId, //
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

// Listen for tab activation
chrome.tabs.onActivated.addListener(() => {
  console.log("Tab activated");
  sendAllTabsWithActive();
});

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  console.log("Tab created:", tab.id);
  sendAllTabsWithActive();
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  console.log("Tab removed:", tabId);
  sendAllTabsWithActive();
});

// Listen for tab updates (URL, title, etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only send update if URL or title changed
  if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") {
    console.log("Tab updated:", tabId, changeInfo);
    sendAllTabsWithActive();
  }
});

// Listen for tab updates (URL changes, page load, title changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Send updates on multiple status changes, not just "complete"
  if (changeInfo.status || changeInfo.url || changeInfo.title) {
    console.log("Tab updated:", {
      tabId,
      status: changeInfo.status,
      hasUrl: !!changeInfo.url,
    });
    s;
    sendAllTabsWithActive();
  }
});

// Periodic refresh every 2 seconds as a safety net
// setInterval(() => {
//   if (socket && socket.readyState === WebSocket.OPEN) {
//     sendAllTabsWithActive();
//   }
// }, 2000);

chrome.runtime.onStartup.addListener(connectWS);
chrome.runtime.onInstalled.addListener(connectWS);

connectWS();
