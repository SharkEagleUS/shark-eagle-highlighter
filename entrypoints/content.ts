import { showHighlightModal, removeModal } from '@/utils/modal';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    // Inject highlight styles
    injectHighlightStyles();

    // Ensure DOM is fully ready before applying highlights
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        loadAndApplyHighlights();
      });
    } else {
      // DOM is already ready
      loadAndApplyHighlights();
    }

    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'saveHighlight') {
        handleSaveHighlight();
      } else if (message.action === 'refreshHighlights') {
        clearAllHighlights();
        loadAndApplyHighlights();
      } else if (message.action === 'scrollToHighlight') {
        scrollToHighlight(message.highlightId);
      }
    });

    // Add click listener for highlight removal
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains(HIGHLIGHT_CLASS) && e.altKey) {
        const highlightId = target.dataset.highlightId;
        if (highlightId) {
          removeHighlightById(highlightId);
        }
      }
    });
  }
});

const HIGHLIGHT_CLASS = 'text-highlighter-extension-mark';

function injectHighlightStyles(): void {
  if (document.getElementById('text-highlighter-styles')) return;

  const style = document.createElement('style');
  style.id = 'text-highlighter-styles';
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      border-radius: 2px;
      padding: 0 2px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .${HIGHLIGHT_CLASS}.color-yellow {
      background-color: #ffeb3b !important;
    }
    .${HIGHLIGHT_CLASS}.color-yellow:hover {
      background-color: #ffc107 !important;
    }

    .${HIGHLIGHT_CLASS}.color-red {
      background-color: #ff8a80 !important;
    }
    .${HIGHLIGHT_CLASS}.color-red:hover {
      background-color: #ff5252 !important;
    }

    .${HIGHLIGHT_CLASS}.color-green {
      background-color: #b9f6ca !important;
    }
    .${HIGHLIGHT_CLASS}.color-green:hover {
      background-color: #69f0ae !important;
    }

    .${HIGHLIGHT_CLASS}.color-lightBlue {
      background-color: #80d8ff !important;
    }
    .${HIGHLIGHT_CLASS}.color-lightBlue:hover {
      background-color: #40c4ff !important;
    }

    .${HIGHLIGHT_CLASS}.color-lightPurple {
      background-color: #ea80fc !important;
    }
    .${HIGHLIGHT_CLASS}.color-lightPurple:hover {
      background-color: #e040fb !important;
    }
  `;
  document.head.appendChild(style);
}

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

async function loadAndApplyHighlights(): Promise<void> {
  const url = window.location.href;

  const highlights = await new Promise<HighlightPosition[]>((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'getHighlights', url },
      (response) => resolve(response || [])
    );
  });

  console.log(`Loading ${highlights.length} highlights for ${url}`);

  // Apply each highlight
  for (const highlight of highlights) {
    const success = applyHighlight(highlight);
    if (!success) {
      console.warn('Failed to apply highlight:', highlight.id, highlight.text.substring(0, 50));
    }
  }
}

function clearAllHighlights(): void {
  const marks = document.querySelectorAll(`.${HIGHLIGHT_CLASS}`);
  marks.forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark);
    }
    mark.remove();
    parent?.normalize();
  });
}

async function handleSaveHighlight(): Promise<void> {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return;
  }

  const selectedText = selection.toString().trim();
  const highlightData = createHighlightFromSelection(selection);
  if (!highlightData) return;

  // Store the selection range before clearing
  const range = selection.getRangeAt(0).cloneRange();

  // Show modal to get comment and tags
  showHighlightModal(
    selectedText,
    (metadata) => {
      // User clicked Save
      // Add metadata to highlight data
      highlightData.comment = metadata.comment;
      highlightData.tags = metadata.tags;
      highlightData.color = metadata.color;

      // Restore selection and highlight in the DOM
      const newSelection = window.getSelection();
      if (newSelection) {
        newSelection.removeAllRanges();
        newSelection.addRange(range);

        const success = highlightSelection(newSelection, highlightData.id, metadata.color);
        if (success) {
          // Save to storage
          chrome.runtime.sendMessage({
            action: 'saveHighlightData',
            url: window.location.href,
            highlight: highlightData
          });
        }

        // Clear selection
        newSelection.removeAllRanges();
      }
    },
    () => {
      // User clicked Cancel - just clear the selection
      const newSelection = window.getSelection();
      if (newSelection) {
        newSelection.removeAllRanges();
      }
    }
  );
}

function scrollToHighlight(highlightId: string): void {
  const mark = document.querySelector(`[data-highlight-id="${highlightId}"]`);
  if (mark) {
    // Scroll the element into view with smooth behavior
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add a temporary flash effect to draw attention
    const originalBackground = (mark as HTMLElement).style.backgroundColor;
    const element = mark as HTMLElement;

    // Flash animation
    element.style.transition = 'all 0.3s ease';
    element.style.transform = 'scale(1.05)';
    element.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';

    setTimeout(() => {
      element.style.transform = 'scale(1)';
      element.style.boxShadow = 'none';
    }, 600);
  } else {
    console.warn('Highlight not found:', highlightId);
  }
}

async function removeHighlightById(highlightId: string): Promise<void> {
  // Remove from DOM
  const mark = document.querySelector(`[data-highlight-id="${highlightId}"]`);
  if (mark) {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent?.insertBefore(mark.firstChild, mark);
    }
    mark.remove();
    parent?.normalize();
  }

  // Remove from storage
  chrome.runtime.sendMessage({
    action: 'removeHighlightData',
    url: window.location.href,
    highlightId
  });
}

// Get XPath for an element
function getXPath(element: Node): string {
  if (element.nodeType === Node.TEXT_NODE) {
    element = element.parentNode!;
  }

  if (element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = element as Element;

  if (el.id) {
    return `//*[@id="${el.id}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousSibling;

    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE &&
        (sibling as Element).tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    const tagName = current.tagName.toLowerCase();
    parts.unshift(`${tagName}[${index}]`);
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

// Get element by XPath
function getElementByXPath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element;
  } catch {
    return null;
  }
}

// Create highlight position data from selection
function createHighlightFromSelection(selection: Selection): HighlightPosition | null {
  if (!selection.rangeCount || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const text = selection.toString().trim();

  if (!text) return null;

  const container = range.commonAncestorContainer;
  const xpath = getXPath(container);

  // Get surrounding context for verification
  const containerText = container.textContent || '';
  const textStart = containerText.indexOf(text);
  const beforeContext = containerText.substring(Math.max(0, textStart - 50), textStart);
  const afterContext = containerText.substring(textStart + text.length, textStart + text.length + 50);

  // Calculate offset within the container
  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const startOffset = preRange.toString().length;

  return {
    id: crypto.randomUUID(),
    text,
    xpath,
    startOffset,
    endOffset: startOffset + text.length,
    beforeContext,
    afterContext,
    createdAt: Date.now()
  };
}

// Apply highlight from stored position
function applyHighlight(position: HighlightPosition): boolean {
  // Check if highlight already exists
  const existing = document.querySelector(`[data-highlight-id="${position.id}"]`);
  if (existing) {
    console.log('Highlight already exists:', position.id);
    return true;
  }

  const container = getElementByXPath(position.xpath);
  if (!container) {
    console.warn('Container not found for xpath:', position.xpath, '- trying document-wide search');
    // Fallback: try to find text in entire document
    return applyHighlightByContext(document.body, position);
  }

  // Use TreeWalker to find all text nodes
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null
  );

  let currentOffset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const nodeLength = node.textContent?.length || 0;

    if (startNode === null && currentOffset + nodeLength > position.startOffset) {
      startNode = node;
      startNodeOffset = position.startOffset - currentOffset;
    }

    if (currentOffset + nodeLength >= position.endOffset) {
      endNode = node;
      endNodeOffset = position.endOffset - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) {
    return applyHighlightByContext(container, position);
  }

  const range = document.createRange();
  try {
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);

    const rangeText = range.toString();
    if (rangeText !== position.text) {
      return applyHighlightByContext(container, position);
    }
  } catch {
    return applyHighlightByContext(container, position);
  }

  return wrapRangeWithHighlight(range, position.id, position.color || 'yellow');
}

// Fallback: find text by surrounding context
function applyHighlightByContext(container: Element, position: HighlightPosition): boolean {
  const containerText = container.textContent || '';

  // Build a pattern with context
  const searchPattern = position.beforeContext + position.text + position.afterContext;
  const contextIndex = containerText.indexOf(searchPattern);

  let textStart: number;
  if (contextIndex >= 0) {
    console.log('Found highlight using full context');
    textStart = contextIndex + position.beforeContext.length;
  } else {
    // Try without full context, match with partial context
    const partialPattern = position.beforeContext.slice(-20) + position.text + position.afterContext.slice(0, 20);
    const partialIndex = containerText.indexOf(partialPattern);
    if (partialIndex >= 0) {
      console.log('Found highlight using partial context');
      textStart = partialIndex + position.beforeContext.slice(-20).length;
    } else {
      // Last resort: just find the text at the approximate position
      console.log('Trying text-only search for:', position.text.substring(0, 30) + '...');
      const allMatches: number[] = [];
      let searchStart = 0;
      let foundIndex: number;
      while ((foundIndex = containerText.indexOf(position.text, searchStart)) !== -1) {
        allMatches.push(foundIndex);
        searchStart = foundIndex + 1;
      }

      if (allMatches.length === 0) {
        console.warn('Text not found in container:', position.text.substring(0, 50));
        return false;
      }

      console.log(`Found ${allMatches.length} matches, selecting closest to offset ${position.startOffset}`);
      // Find closest match to original offset
      textStart = allMatches.reduce((prev, curr) =>
        Math.abs(curr - position.startOffset) < Math.abs(prev - position.startOffset) ? curr : prev
      );
    }
  }

  // Find text nodes at this position
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    const nodeLength = textNode.textContent?.length || 0;

    if (startNode === null && currentOffset + nodeLength > textStart) {
      startNode = textNode;
      startNodeOffset = textStart - currentOffset;
    }

    if (currentOffset + nodeLength >= textStart + position.text.length) {
      endNode = textNode;
      endNodeOffset = textStart + position.text.length - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return false;

  try {
    const range = document.createRange();
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    return wrapRangeWithHighlight(range, position.id, position.color || 'yellow');
  } catch {
    return false;
  }
}

// Wrap a range with highlight markup
function wrapRangeWithHighlight(range: Range, highlightId: string, color: HighlightColor = 'yellow'): boolean {
  try {
    const mark = document.createElement('mark');
    mark.className = `${HIGHLIGHT_CLASS} color-${color}`;
    mark.dataset.highlightId = highlightId;

    range.surroundContents(mark);
    return true;
  } catch {
    // Handle complex ranges that span multiple elements
    try {
      const fragment = range.extractContents();
      const mark = document.createElement('mark');
      mark.className = `${HIGHLIGHT_CLASS} color-${color}`;
      mark.dataset.highlightId = highlightId;
      mark.appendChild(fragment);
      range.insertNode(mark);
      return true;
    } catch {
      return false;
    }
  }
}

// Highlight selection immediately
function highlightSelection(selection: Selection, highlightId: string, color: HighlightColor = 'yellow'): boolean {
  if (!selection.rangeCount || selection.isCollapsed) return false;

  const range = selection.getRangeAt(0);
  return wrapRangeWithHighlight(range, highlightId, color);
}
