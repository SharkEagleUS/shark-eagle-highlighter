# Text Highlighter Chrome Extension

A Chrome extension (MV3) built with [WXT](https://wxt.dev/) that allows you to save and highlight text selections. Highlights persist and are automatically restored when you revisit the page.

## Features

- **Right-click to Save**: Select text on any webpage, right-click, and choose "Save & Highlight Text"
- **Persistent Highlights**: Highlights are saved to local storage and automatically restored on page revisit
- **Position Tracking**: Correctly identifies the exact text you highlighted, even when the same text appears multiple times on the page
- **Side Panel**: View and manage all your highlights in Chrome's side panel
- **Easy Removal**: Alt+Click on a highlight or use the context menu to remove it

## How Position Tracking Works

The extension uses multiple strategies to accurately identify highlighted text:

1. **XPath + Offset**: Stores the XPath to the container element and the character offset within it
2. **Context Matching**: Stores surrounding text (50 characters before/after) to verify correct matches
3. **Fallback Matching**: If exact offset fails, uses context to find the correct occurrence

## Installation

### Development

```bash
# Install dependencies
npm install

# Start development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Create zip for distribution
npm run zip
```

### Load in Chrome

1. Run `npm run build`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `.output/chrome-mv3` folder

## Usage

1. **Save a highlight**: Select text → Right-click → "Save & Highlight Text"
2. **View highlights**: Click the extension icon to open the side panel
3. **Remove a highlight**:
   - Alt+Click on the highlighted text, OR
   - Click "Delete" in the side panel
4. **Revisit a page**: Highlights are automatically restored

## Project Structure

```
chrome-highlighter/
├── entrypoints/
│   ├── background.ts        # Background service worker
│   ├── content.ts           # Content script (injected into pages)
│   └── sidepanel/           # Side panel UI
│       ├── index.html
│       └── main.ts
├── utils/
│   ├── storage.ts           # Storage utilities
│   └── highlighter.ts       # DOM highlighting utilities
├── wxt.config.ts            # WXT configuration
└── package.json
```

## Technical Details

- **Manifest Version**: 3 (MV3)
- **Framework**: WXT (Vite-based extension framework)
- **Storage**: Chrome Local Storage
- **Permissions**: `storage`, `contextMenus`, `sidePanel`
