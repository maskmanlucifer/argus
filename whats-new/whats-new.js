document.getElementById('version-sub').textContent = `v${chrome.runtime.getManifest().version}`;

// Mac keyboards label this key Option (⌥), not Alt — show what users will recognize.
const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
if (isMac) {
  document.querySelectorAll('.js-alt-key').forEach(el => { el.textContent = '⌥'; });
}
