// Content script for volume control
(function() {
    'use strict';

    let currentVolume = 1.0; // Default volume (100%)
    let originalVolumes = new WeakMap(); // Store original volumes of audio/video elements
    let isInitialized = false;
    let volumeEnforcementInterval = null;
    let tabId = null;

    // Get current tab ID
    async function getCurrentTabId() {
        if (tabId) return tabId;
        
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getTabInfo' });
            if (response && response.success) {
                tabId = response.tab.id;
                return tabId;
            }
        } catch (error) {
            console.error('Error getting tab ID:', error);
        }
        return null;
    }

    // Load saved volume from storage
    async function loadSavedVolume() {
        const currentTabId = await getCurrentTabId();
        if (!currentTabId) return;

        try {
            const result = await chrome.storage.local.get([`volume_${currentTabId}`]);
            const savedVolume = result[`volume_${currentTabId}`];
            if (savedVolume !== undefined) {
                currentVolume = savedVolume / 100; // Convert from percentage to 0-1
                console.log(`Loaded saved volume: ${savedVolume}% for tab ${currentTabId}`);
            }
        } catch (error) {
            console.error('Error loading saved volume:', error);
        }
    }

    // Initialize volume control
    async function init() {
        if (isInitialized) return;
        isInitialized = true;

        // Load saved volume first
        await loadSavedVolume();

        // Apply volume to existing media elements
        applyVolumeToAllMedia();

        // Listen for new media elements
        observeMediaElements();

        // Start volume enforcement for YouTube and other dynamic sites
        startVolumeEnforcement();

        console.log('Volume control initialized with volume:', currentVolume);
    }

    // Find and control all audio/video elements
    function applyVolumeToAllMedia() {
        const mediaElements = document.querySelectorAll('audio, video');
        
        mediaElements.forEach(element => {
            // Store original volume if not already stored
            if (!originalVolumes.has(element)) {
                originalVolumes.set(element, element.volume);
            }
            
            // Force apply current volume (override any video changes)
            element.volume = currentVolume;
        });
    }

    // Start continuous volume enforcement (especially for YouTube)
    function startVolumeEnforcement() {
        // Clear any existing interval
        if (volumeEnforcementInterval) {
            clearInterval(volumeEnforcementInterval);
        }

        // Check and enforce volume every 500ms
        volumeEnforcementInterval = setInterval(() => {
            const mediaElements = document.querySelectorAll('audio, video');
            let enforcedAny = false;

            mediaElements.forEach(element => {
                if (Math.abs(element.volume - currentVolume) > 0.01) { // Allow small floating point differences
                    element.volume = currentVolume;
                    enforcedAny = true;
                }
            });

            if (enforcedAny) {
                console.log(`Volume enforced to ${Math.round(currentVolume * 100)}%`);
            }
        }, 500);
    }

    // Stop volume enforcement
    function stopVolumeEnforcement() {
        if (volumeEnforcementInterval) {
            clearInterval(volumeEnforcementInterval);
            volumeEnforcementInterval = null;
        }
    }

    // Observe for dynamically added media elements
    function observeMediaElements() {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is a media element
                        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
                            handleNewMediaElement(node);
                        }
                        
                        // Check for media elements within the added node
                        const mediaElements = node.querySelectorAll && node.querySelectorAll('audio, video');
                        if (mediaElements) {
                            mediaElements.forEach(handleNewMediaElement);
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Handle newly added media elements
    function handleNewMediaElement(element) {
        // Store original volume
        if (!originalVolumes.has(element)) {
            originalVolumes.set(element, element.volume);
        }
        
        // Immediately apply current volume
        element.volume = currentVolume;

        // Add multiple event listeners for robust volume control
        const enforceVolume = () => {
            if (Math.abs(element.volume - currentVolume) > 0.01) {
                element.volume = currentVolume;
            }
        };

        // Listen for various events that might change volume
        element.addEventListener('volumechange', enforceVolume);
        element.addEventListener('loadstart', enforceVolume);
        element.addEventListener('loadeddata', enforceVolume);
        element.addEventListener('canplay', enforceVolume);
        element.addEventListener('playing', enforceVolume);
        
        // For YouTube specifically, also listen for these events
        element.addEventListener('timeupdate', enforceVolume);
        
        // Delayed enforcement for newly loaded content
        setTimeout(() => {
            element.volume = currentVolume;
        }, 100);
    }

    // Set volume for all media elements
    function setVolume(volume) {
        currentVolume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
        applyVolumeToAllMedia();
        
        // Immediately enforce the new volume multiple times for stubborn sites like YouTube
        setTimeout(() => applyVolumeToAllMedia(), 50);
        setTimeout(() => applyVolumeToAllMedia(), 200);
        setTimeout(() => applyVolumeToAllMedia(), 500);
    }

    // Set mute state for all media elements
    function setMute(muted) {
        const mediaElements = document.querySelectorAll('audio, video');
        mediaElements.forEach(element => {
            element.muted = muted;
        });
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            switch (message.action) {
                case 'setVolume':
                    setVolume(message.volume);
                    sendResponse({ success: true, volume: currentVolume });
                    break;

                case 'setMute':
                    setMute(message.muted);
                    sendResponse({ success: true, muted: message.muted });
                    break;

                case 'getVolume':
                    sendResponse({ success: true, volume: currentVolume });
                    break;

                case 'getMediaInfo':
                    const mediaElements = document.querySelectorAll('audio, video');
                    const mediaInfo = {
                        count: mediaElements.length,
                        elements: Array.from(mediaElements).map(el => ({
                            tagName: el.tagName,
                            volume: el.volume,
                            muted: el.muted,
                            paused: el.paused
                        }))
                    };
                    sendResponse({ success: true, mediaInfo });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error in content script:', error);
            sendResponse({ success: false, error: error.message });
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Also initialize after short delays to catch any late-loading media
    setTimeout(init, 1000);
    setTimeout(init, 3000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        stopVolumeEnforcement();
    });

    // Reinforce volume control when tab becomes visible (YouTube specific)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(() => {
                applyVolumeToAllMedia();
            }, 500);
        }
    });

})();