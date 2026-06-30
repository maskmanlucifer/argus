// Service worker — handles install onboarding and the keyboard shortcut command.

const RESTRICTED = /^(chrome|chrome-extension|about|data|devtools|file):/i;

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'argus-resize-window' && msg.type !== 'argus-maximize-window') return;
  const tabId = sender.tab?.id;
  if (!tabId) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.windowId) return;
    if (msg.type === 'argus-maximize-window') {
      chrome.windows.update(tab.windowId, { state: 'maximized' });
    } else {
      chrome.windows.update(tab.windowId, { width: msg.width });
    }
  });
});

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
