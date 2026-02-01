export default defineBackground(() => {
  // Create context menu on install
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'save-highlight',
      title: 'Save & Highlight Text',
      contexts: ['selection']
    });
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
      // Forward to get highlights for URL
      getHighlightsForUrl(message.url).then(sendResponse);
      return true;
    } else if (message.action === 'saveHighlightData') {
      // Save highlight data
      saveHighlightData(message.url, message.highlight).then(sendResponse);
      return true;
    } else if (message.action === 'removeHighlightData') {
      // Remove highlight data
      removeHighlightData(message.url, message.highlightId).then(sendResponse);
      return true;
    } else if (message.action === 'getAllHighlights') {
      getAllHighlightsData().then(sendResponse);
      return true;
    }
  });
});

// Storage functions
type HighlightColor = 'yellow' | 'red' | 'green' | 'lightBlue' | 'lightPurple';

interface HighlightPosition {
  text: string;
  xpath: string;
  startOffset: number;
  endOffset: number;
  beforeContext: string;
  afterContext: string;
  id: string;
  createdAt: number;
  comment?: string;
  tags?: string[];
  color?: HighlightColor;
}

interface PageHighlights {
  url: string;
  highlights: HighlightPosition[];
}

const STORAGE_PREFIX = 'highlights_';

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
  } catch {
    return url;
  }
}

function getStorageKey(url: string): string {
  return STORAGE_PREFIX + normalizeUrl(url);
}

async function getHighlightsForUrl(url: string): Promise<HighlightPosition[]> {
  const key = getStorageKey(url);
  const result = await chrome.storage.local.get(key);
  const data = result[key] as PageHighlights | undefined;
  return data?.highlights || [];
}

async function saveHighlightData(url: string, highlight: HighlightPosition): Promise<boolean> {
  try {
    const key = getStorageKey(url);
    const highlights = await getHighlightsForUrl(url);
    highlights.push(highlight);
    await chrome.storage.local.set({ [key]: { url: normalizeUrl(url), highlights } });
    return true;
  } catch (e) {
    console.error('Failed to save highlight:', e);
    return false;
  }
}

async function removeHighlightData(url: string, highlightId: string): Promise<boolean> {
  try {
    const key = getStorageKey(url);
    const highlights = await getHighlightsForUrl(url);
    const filtered = highlights.filter(h => h.id !== highlightId);
    await chrome.storage.local.set({ [key]: { url: normalizeUrl(url), highlights: filtered } });
    return true;
  } catch (e) {
    console.error('Failed to remove highlight:', e);
    return false;
  }
}

async function getAllHighlightsData(): Promise<PageHighlights[]> {
  const result = await chrome.storage.local.get(null);
  const pages: PageHighlights[] = [];
  
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith(STORAGE_PREFIX)) {
      pages.push(value as PageHighlights);
    }
  }
  
  return pages;
}
