import { storageService } from '../supabase/services/storage';
import { authService } from '../supabase/services/auth';
import { syncService } from '../supabase/services/sync';

export default defineBackground(() => {
  // Create context menu on install
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Highlight Text',
      contexts: ['selection']
    });

    // Initialize auth service and enable realtime sync if authenticated
    initializeServices();
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === 'save-highlight') {
      // Send message to content script to save the selection
      chrome.tabs.sendMessage(tab.id, { action: 'saveHighlight' });
    }
  });

  // Handle action click to open side panel
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getHighlights') {
      // Forward to get highlights for URL using unified storage service
      storageService.getHighlightsForUrl(message.url).then(sendResponse);
      return true;
    } else if (message.action === 'saveHighlightData') {
      // Save highlight data using unified storage service (auto-syncs to cloud)
      storageService.saveHighlight(message.url, message.highlight).then(sendResponse);
      return true;
    } else if (message.action === 'updateHighlightData') {
      // Update highlight data using unified storage service (auto-syncs to cloud)
      storageService.updateHighlight(message.url, message.highlightId, message.updates).then(sendResponse);
      return true;
    } else if (message.action === 'removeHighlightData') {
      // Remove highlight data using unified storage service (auto-syncs to cloud)
      storageService.removeHighlight(message.url, message.highlightId).then(sendResponse);
      return true;
    } else if (message.action === 'getAllHighlights') {
      storageService.getAllHighlights().then(sendResponse);
      return true;
    } else if (message.action === 'performSync') {
      // Manual sync trigger
      storageService.performFullSync().then(sendResponse);
      return true;
    }
  });

  // Initialize services
  async function initializeServices() {
    try {
      const isAuth = await authService.isAuthenticated();
      if (isAuth) {
        // Enable realtime sync for authenticated users
        await syncService.enableRealtimeSync();
        console.log('Realtime sync enabled');
      }
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  }

  // Listen for auth state changes to enable/disable realtime sync
  authService.onAuthStateChange(async (state) => {
    if (state.isAuthenticated) {
      await syncService.enableRealtimeSync();
      console.log('Realtime sync enabled');
    } else {
      await syncService.disableRealtimeSync();
      console.log('Realtime sync disabled');
    }
  });

  // Initialize services on startup
  initializeServices();
});
