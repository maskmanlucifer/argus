const btn   = document.getElementById('toggle-btn');
const label = document.getElementById('toggle-label');

const RESTRICTED = /^(chrome|chrome-extension|about|data|devtools|file):/i;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab ?? null;
}

async function getState() {
  const tab = await getActiveTab();
  if (!tab?.id || RESTRICTED.test(tab.url ?? '')) return false;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__argusIsVisible?.() ?? false,
    });
    return result ?? false;
  } catch {
    return false;
  }
}

function setState(active) {
  label.textContent = active ? 'Close Inspector' : 'Open Inspector';
  btn.classList.toggle('active', active);
}

getState().then(setState);

btn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id || RESTRICTED.test(tab.url ?? '')) { window.close(); return; }
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__argusToggle?.() });
  } catch {
    // page doesn't allow injection
  }
  window.close();
});
