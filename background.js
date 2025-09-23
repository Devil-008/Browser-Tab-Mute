// Enhanced background script for volume control extension

// Handle extension installation/startup
chrome.runtime.onInstalled.addListener(() => {
  console.log('Volume Control Extension installed');
});

// Update icon and tooltip based on tab mute state
async function updateIconAndTooltip(tabId, isMuted) {
  const iconPath = isMuted ? "icons/icon-muted.png" : "icons/icon-unmuted.png";
  const tooltipTitle = isMuted ? "Unmute Tab" : "Mute Tab";

  try {
    await chrome.action.setIcon({ path: iconPath, tabId: tabId });
    await chrome.action.setTitle({ title: tooltipTitle, tabId: tabId });
  } catch (error) {
    console.error('Error updating icon/tooltip:', error);
  }
}

// Listen for tab updates (including mute state changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.mutedInfo) {
    await updateIconAndTooltip(tabId, changeInfo.mutedInfo.muted);
  }
});

// Set initial icon state for active tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    const isMuted = tab.mutedInfo && tab.mutedInfo.muted;
    await updateIconAndTooltip(activeInfo.tabId, isMuted);
  } catch (error) {
    console.error('Error updating icon for active tab:', error);
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getTabInfo') {
    // If called from content script, use sender.tab
    if (sender.tab) {
      sendResponse({
        success: true,
        tab: {
          id: sender.tab.id,
          title: sender.tab.title,
          url: sender.tab.url,
          muted: sender.tab.mutedInfo && sender.tab.mutedInfo.muted
        }
      });
    } else {
      // If called from popup, get active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          sendResponse({
            success: true,
            tab: {
              id: tabs[0].id,
              title: tabs[0].title,
              url: tabs[0].url,
              muted: tabs[0].mutedInfo && tabs[0].mutedInfo.muted
            }
          });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      });
    }
    return true; // Keep message channel open for async response
  }

  if (message.action === 'muteTab') {
    chrome.tabs.update(message.tabId, { muted: message.muted }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Initialize icon state when extension loads
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]) {
    const tab = tabs[0];
    const isMuted = tab.mutedInfo && tab.mutedInfo.muted;
    await updateIconAndTooltip(tab.id, isMuted);
  }
});
