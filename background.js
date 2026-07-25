// Service worker — handles install onboarding, the toolbar icon click, and the keyboard shortcut command.

const RESTRICTED = /^(chrome|chrome-extension|about|data|devtools|file):/i;

async function toggleArgusOnTab(tab) {
  if (!tab?.id || RESTRICTED.test(tab.url ?? '')) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__argusToggle?.() });
  } catch {
    // page may block script injection (e.g. chrome web store)
  }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/onboarding.html') });
    // Fresh installs already see the onboarding page — don't also badge What's New.
    chrome.storage.local.set({ argus_seen_version: chrome.runtime.getManifest().version });
  }
});

// Toolbar icon click — no popup, so this fires directly on every click.
chrome.action.onClicked.addListener(toggleArgusOnTab);

// Reflect the current (possibly user-rebound) shortcut in the icon's hover tooltip.
async function updateActionTitle() {
  const commands = await chrome.commands.getAll();
  const cmd = commands.find(c => c.name === 'toggle-argus');
  const shortcut = cmd?.shortcut || 'Alt+Shift+A';
  chrome.action.setTitle({ title: `Argus Inspector (${shortcut})` });
}
chrome.runtime.onInstalled.addListener(updateActionTitle);
chrome.runtime.onStartup.addListener(updateActionTitle);

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
  await toggleArgusOnTab(tab);
});
