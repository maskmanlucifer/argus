const PRESETS = [
  { label: 'Mobile',  px: 375 },
  { label: 'Tablet',  px: 768 },
  { label: 'Laptop',  px: 1280 },
  { label: 'Desktop', px: 1440 },
];

const MIN_W = 320;

export class ViewportTool {
  constructor(toolbar) {
    this.tb      = toolbar;
    this._active = false;
    this.panel   = null;
  }

  activate() {
    this._active = true;
    this._style = document.createElement('style');
    this._style.textContent = 'html,body{overflow-x:auto!important;min-width:0!important;}';
    document.documentElement.appendChild(this._style);
    this._onResize = () => {
      clearTimeout(this._resizeRaf);
      this._resizeRaf = setTimeout(() => {
        if (!this.panel) return;
        this._renderPanel(this.panel);
        this._positionPanel();
      }, 100);
    };
    window.addEventListener('resize', this._onResize);
    this._showPanel();
  }

  deactivate() {
    this._active = false;
    clearTimeout(this._resizeTimer);
    clearTimeout(this._resizeRaf);
    window.removeEventListener('resize', this._onResize);
    this._style?.remove();
    this._style = null;
    this.panel?.remove();
    this.panel = null;
  }

  destroy() { this.deactivate(); }
  onEsc()   {}

  /** Send resize request to background service worker. */
  _resize(w) {
    w = Math.max(MIN_W, Math.min(window.screen.width, Math.round(w)));
    chrome.runtime.sendMessage({ type: 'argus-resize-window', width: w }).catch(() => {});
    // Re-render after a short delay so innerWidth has updated
    setTimeout(() => {
      if (!this.panel) return;
      this._renderPanel(this.panel);
      this._positionPanel();
    }, 80);
  }

  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;
    p.style.width = '200px';
    this._renderPanel(p);
    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel();
  }

  _renderPanel(p) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const maxW = window.screen.width;
    p.innerHTML = `
      <div class="panel-label">Screen Size</div>
      <div class="vp-size">
        <span class="vp-size-w">${w}</span><span class="vp-size-sep">×</span><span class="vp-size-h">${h}</span><span class="vp-size-unit">px</span>
      </div>
      <div class="vp-presets">
        ${PRESETS.map(({ label, px }) => `
          <button class="vp-preset${Math.abs(w - px) < 2 ? ' vp-preset--on' : ''}" data-px="${px}">
            <span class="vp-preset-name">${label}</span>
            <span class="vp-preset-px">${px}</span>
          </button>
        `).join('')}
        <button class="vp-preset vp-preset--full">
          <span class="vp-preset-name">Full</span>
          <svg width="9" height="9" viewBox="0 0 11 11" fill="none"><path d="M1 4V1h3M7 1h3v3M10 7v3H7M4 10H1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="vp-input-row">
        <input class="vp-input" type="number" min="${MIN_W}" max="${maxW}" value="${w}" placeholder="width">
        <span class="vp-input-unit">px</span>
        <button class="vp-input-btn">↵</button>
      </div>
    `;

    p.querySelectorAll('.vp-preset').forEach(btn => {
      if (btn.classList.contains('vp-preset--full')) {
        btn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ type: 'argus-maximize-window' }).catch(() => {});
        });
      } else {
        btn.addEventListener('click', () => this._resize(Number(btn.dataset.px)));
      }
    });

    const input  = p.querySelector('.vp-input');
    const commit = () => {
      const v = Math.max(MIN_W, Math.min(window.screen.width, Number(input.value) || w));
      input.value = v;
      this._resize(v);
    };
    p.querySelector('.vp-input-btn').addEventListener('click', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    input.addEventListener('focus', () => input.select());
  }

  _positionPanel() {
    if (!this.panel) return;
    const rail = this.tb.rail.getBoundingClientRect();
    const pl   = this.tb.placement;
    const gap  = 6;
    const M    = 8;

    Object.assign(this.panel.style, { top: '0px', left: '0px' });
    const pw = this.panel.getBoundingClientRect().width;
    const ph = this.panel.getBoundingClientRect().height;

    let top, left;
    if      (pl === 'left')   { left = rail.right + gap;     top  = rail.top; }
    else if (pl === 'right')  { left = rail.left - pw - gap; top  = rail.top; }
    else if (pl === 'top')    { top  = rail.bottom + gap;    left = rail.right - pw; }
    else                      { top  = rail.top - ph - gap;  left = rail.right - pw; }

    left = Math.max(M, Math.min(left, window.innerWidth  - pw - M));
    top  = Math.max(M, Math.min(top,  window.innerHeight - ph - M));
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); }
}
