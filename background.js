// chrome.action.onClicked.addListener((tab) => {
//   const isMuted = tab.mutedInfo && tab.mutedInfo.muted;

//   chrome.tabs.update(tab.id, { muted: !isMuted }, () => {
//     const iconPath = isMuted
//       ? "icons/icon-unmuted.png"
//       : "icons/icon-muted.png";
//     chrome.action.setIcon({ path: iconPath, tabId: tab.id });
//   });
// });


chrome.action.onClicked.addListener((tab) => {
  const isMuted = tab.mutedInfo && tab.mutedInfo.muted;

  chrome.tabs.update(tab.id, { muted: !isMuted }, () => {
    const iconPath = isMuted
      ? "icons/icon-unmuted.png"
      : "icons/icon-muted.png";

    const tooltipTitle = isMuted ? "Mute Tab" : "Unmute Tab";

    chrome.action.setIcon({ path: iconPath, tabId: tab.id });
    chrome.action.setTitle({ title: tooltipTitle, tabId: tab.id });
  });
});

// ✅ Set initial tooltip when extension loads (for current tab)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.id) return;

  chrome.tabs.get(tab.id, (updatedTab) => {
    const isMuted = updatedTab.mutedInfo && updatedTab.mutedInfo.muted;
    const tooltipTitle = isMuted ? "Unmute Tab" : "Mute Tab";
    chrome.action.setTitle({ title: tooltipTitle, tabId: tab.id });
  });
});
