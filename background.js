// Service worker — handles the keyboard shortcut command.

const RESTRICTED = /^(chrome|chrome-extension|about|data|devtools|file):/i;

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-argus') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id || RESTRICTED.test(tab.url ?? '')) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__argusToggle?.() });
  } catch {
    // page may block script injection (e.g. chrome web store)
  }
});
