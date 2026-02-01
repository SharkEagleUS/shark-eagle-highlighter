import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  modules: [],
  manifest: {
    name: 'Text Highlighter',
    description: 'Save and highlight text selections across page visits',
    version: '1.0.0',
    permissions: ['storage', 'contextMenus', 'sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html'
    },
    action: {
      default_title: 'Open Highlighter Panel'
    }
  },
  webExt: {
    startUrls: ['https://hzhou.me/2020/12/24/SaltyNote-Server-Setup/']
  }
});
