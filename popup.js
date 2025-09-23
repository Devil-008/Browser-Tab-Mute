document.addEventListener('DOMContentLoaded', async () => {
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeValue = document.getElementById('volumeValue');
    const muteBtn = document.getElementById('muteBtn');
    const muteIcon = document.getElementById('muteIcon');
    const muteText = document.getElementById('muteText');
    const resetBtn = document.getElementById('resetBtn');
    const tabInfo = document.getElementById('tabInfo');

    let currentTab = null;
    let isInitializing = true;

    // Get current tab
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tabs[0];
        
        if (currentTab) {
            tabInfo.textContent = currentTab.title || 'Current Tab';
            await loadTabState();
        }
    } catch (error) {
        console.error('Error getting current tab:', error);
        tabInfo.textContent = 'Error loading tab';
    }

    isInitializing = false;

    // Load saved volume and mute state for the current tab
    async function loadTabState() {
        if (!currentTab) return;

        try {
            // Get saved volume for this tab
            const result = await chrome.storage.local.get([
                `volume_${currentTab.id}`,
                `muted_${currentTab.id}`
            ]);

            const savedVolume = result[`volume_${currentTab.id}`] || 100;
            const savedMuted = result[`muted_${currentTab.id}`] || false;

            // Update UI
            volumeSlider.value = savedVolume;
            volumeValue.textContent = `${savedVolume}%`;
            updateMuteButton(savedMuted);

        } catch (error) {
            console.error('Error loading tab state:', error);
        }
    }

    // Save volume for current tab
    async function saveVolume(volume) {
        if (!currentTab) return;
        
        try {
            await chrome.storage.local.set({
                [`volume_${currentTab.id}`]: volume
            });
        } catch (error) {
            console.error('Error saving volume:', error);
        }
    }

    // Save mute state for current tab
    async function saveMuteState(muted) {
        if (!currentTab) return;
        
        try {
            await chrome.storage.local.set({
                [`muted_${currentTab.id}`]: muted
            });
        } catch (error) {
            console.error('Error saving mute state:', error);
        }
    }

    // Update mute button appearance
    function updateMuteButton(isMuted) {
        if (isMuted) {
            muteBtn.classList.add('muted');
            muteIcon.textContent = '🔇';
            muteText.textContent = 'Unmute';
        } else {
            muteBtn.classList.remove('muted');
            muteIcon.textContent = '🔊';
            muteText.textContent = 'Mute';
        }
    }

    // Apply volume to current tab
    async function applyVolume(volume) {
        if (!currentTab) return;

        try {
            await chrome.tabs.sendMessage(currentTab.id, {
                action: 'setVolume',
                volume: volume / 100
            });
        } catch (error) {
            // If content script is not injected, inject it first
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    files: ['content.js']
                });
                
                // Try again after injection
                setTimeout(async () => {
                    try {
                        await chrome.tabs.sendMessage(currentTab.id, {
                            action: 'setVolume',
                            volume: volume / 100
                        });
                    } catch (retryError) {
                        console.error('Error applying volume after retry:', retryError);
                    }
                }, 100);
            } catch (injectionError) {
                console.error('Error injecting content script:', injectionError);
            }
        }
    }

    // Apply mute to current tab
    async function applyMute(muted) {
        if (!currentTab) return;

        try {
            // Use Chrome's native tab muting
            await chrome.tabs.update(currentTab.id, { muted: muted });
            
            // Also send message to content script for additional control
            await chrome.tabs.sendMessage(currentTab.id, {
                action: 'setMute',
                muted: muted
            });
        } catch (error) {
            console.error('Error applying mute:', error);
        }
    }

    // Volume slider event
    volumeSlider.addEventListener('input', async (e) => {
        if (isInitializing) return;
        
        const volume = parseInt(e.target.value);
        volumeValue.textContent = `${volume}%`;
        
        await saveVolume(volume);
        await applyVolume(volume);
    });

    // Mute button event
    muteBtn.addEventListener('click', async () => {
        if (!currentTab) return;

        const currentlyMuted = muteBtn.classList.contains('muted');
        const newMutedState = !currentlyMuted;
        
        updateMuteButton(newMutedState);
        await saveMuteState(newMutedState);
        await applyMute(newMutedState);
    });

    // Reset button event
    resetBtn.addEventListener('click', async () => {
        volumeSlider.value = 100;
        volumeValue.textContent = '100%';
        updateMuteButton(false);
        
        await saveVolume(100);
        await saveMuteState(false);
        await applyVolume(100);
        await applyMute(false);
    });

    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (currentTab && tabId === currentTab.id && changeInfo.mutedInfo) {
            updateMuteButton(changeInfo.mutedInfo.muted);
        }
    });
});