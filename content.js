(() => {
  if (window.__argusLoaded) return;
  window.__argusLoaded = true;

  let mounting = false;

  function mount() {
    if (mounting || document.getElementById('argus-host')) return;
    mounting = true;

    const host = document.createElement('div');
    host.id = 'argus-host';
    host.style.cssText = 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = chrome.runtime.getURL('toolbar/toolbar.css');
    shadow.appendChild(link);

    const container = document.createElement('div');
    container.id = 'argus-root';
    shadow.appendChild(container);

    const cleanup = () => { mounting = false; host.remove(); };

    link.onerror = cleanup;
    link.onload = () => {
      import(chrome.runtime.getURL('toolbar/toolbar.js')).then(({ Toolbar }) => {
        mounting = false;
        const tb = new Toolbar({ shadow, container, host });
        window.__argus_toolbar = tb;
      }).catch(cleanup);
    };
  }

  // Exposed on window so background can call it directly via executeScript
  window.__argusToggle = () => {
    if (window.__argus_toolbar) window.__argus_toolbar.toggle();
    else mount();
  };

  window.__argusIsVisible = () => window.__argus_toolbar?.isVisible() ?? false;
})();
