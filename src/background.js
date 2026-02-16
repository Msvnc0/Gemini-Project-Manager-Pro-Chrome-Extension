/**
 * background.js — Service Worker
 * Handles installation defaults and message routing.
 */

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      gpm_projects: [],
      gpm_chatMap: {},
      gpm_quickPrompts: [],
      gpm_settings: { lang: 'en', theme: 'auto' },
      gpm_pinnedChats: {}
    });
    console.log('[GPM] Initialized default storage.');
  }
});

// Message relay between content script instances (if needed for multi-tab sync)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GPM_STORAGE_UPDATED') {
    // Broadcast to all Gemini tabs so they re-render
    chrome.tabs.query({ url: 'https://gemini.google.com/*' }, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id !== sender.tab?.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'GPM_SYNC' });
        }
      });
    });
    sendResponse({ ok: true });
  }
  return true;
});
