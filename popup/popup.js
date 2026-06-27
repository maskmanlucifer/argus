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

// Show the current keyboard shortcut (reflects any user rebinds in chrome://extensions/shortcuts)
chrome.commands.getAll(commands => {
  const cmd = commands.find(c => c.name === 'toggle-argus');
  const hint = document.getElementById('shortcut-hint');
  if (!hint) return;
  if (cmd?.shortcut) {
    hint.innerHTML = `<span class="shortcut-key">${cmd.shortcut}</span> to toggle`;
  } else {
    hint.innerHTML = `<a href="chrome://extensions/shortcuts" style="color:inherit;opacity:0.6;font-size:11px;">Set a shortcut</a>`;
  }
});

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
