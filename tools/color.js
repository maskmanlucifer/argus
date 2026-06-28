export class ColorTool {
  constructor(toolbar) {
    this.tb      = toolbar;
    this.panel   = null;
    this.palette = [];
    this._loadPalette();
  }

  async _loadPalette() {
    const data = await chrome.storage.local.get('argus_palette');
    this.palette = data.argus_palette || [];
    if (this.panel) this._renderPalette();
  }

  _savePalette() {
    chrome.storage.local.set({ argus_palette: this.palette });
  }

  activate()  { this._showPanel(); }
  deactivate() { this.panel?.remove(); this.panel = null; }
  destroy()    { this.deactivate(); }

  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;
    p.innerHTML = `
      <div class="panel-label">Color Picker</div>
      <button class="color-pick-btn">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8"/></svg>
        Pick color from page
      </button>
      <div class="color-result" style="display:none;">
        <div class="color-swatch-large"></div>
        <div class="color-values"></div>
        <button class="color-save-btn">Save to palette</button>
      </div>
      <div class="palette-section">
        <div class="palette-header">
          <span class="palette-label">Saved</span>
          <span class="palette-count"></span>
        </div>
        <div class="palette-grid"></div>
        <div class="palette-empty">Pick a color to save it here.</div>
      </div>
    `;

    p.querySelector('.color-pick-btn').addEventListener('click', () => this._pick(p));
    p.querySelector('.color-save-btn').addEventListener('click', () => {
      const hex = p.querySelector('.color-swatch-large').dataset.color;
      if (hex) this._saveColor(hex, p);
    });

    this.panel = p;
    this.tb.shadow.appendChild(p);
    this._renderPalette();
    this._positionPanel();
  }

  async _pick(p) {
    if (!window.EyeDropper) {
      const btn = p.querySelector('.color-pick-btn');
      btn.textContent = 'Not supported in this browser';
      btn.disabled = true;
      return;
    }
    try {
      const result = await new EyeDropper().open();
      this._showResult(p, result.sRGBHex);
    } catch {
      // user cancelled — no-op
    }
  }

  _showResult(p, hex) {
    const { r, g, b } = this._hexToRgb(hex);
    const { h, s, l } = this._rgbToHsl(r, g, b);
    const rgb  = `rgb(${r}, ${g}, ${b})`;
    const hsl  = `hsl(${h}, ${s}%, ${l}%)`;

    const result = p.querySelector('.color-result');
    result.style.display = '';

    const swatch = result.querySelector('.color-swatch-large');
    swatch.style.background = hex;
    swatch.dataset.color = hex;

    result.querySelector('.color-values').innerHTML = [
      { label: 'HEX', value: hex },
      { label: 'RGB', value: rgb },
      { label: 'HSL', value: hsl },
    ].map(({ label, value }) => `
      <div class="color-value-row">
        <span class="color-value-label">${label}</span>
        <span class="color-value-text">${value}</span>
        <button class="color-copy-btn" data-value="${value}" title="Copy">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/></svg>
        </button>
      </div>
    `).join('');

    result.querySelectorAll('.color-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.value);
        btn.innerHTML = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="#0ABE51" stroke-width="2" stroke-linecap="round"><polyline points="2,8 6,12 14,4"/></svg>`;
        setTimeout(() => {
          btn.innerHTML = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v1"/></svg>`;
        }, 1500);
      });
    });
  }

  _saveColor(hex, p) {
    if (!this.palette.includes(hex)) {
      this.palette.unshift(hex);
      if (this.palette.length > 24) this.palette.pop();
      this._savePalette();
    }
    const btn = p.querySelector('.color-save-btn');
    btn.textContent = 'Saved ✓';
    setTimeout(() => { btn.textContent = 'Save to palette'; }, 1500);
    this._renderPalette();
  }

  _renderPalette() {
    if (!this.panel) return;
    const grid  = this.panel.querySelector('.palette-grid');
    const empty = this.panel.querySelector('.palette-empty');
    const count = this.panel.querySelector('.palette-count');
    grid.innerHTML = '';
    const has = this.palette.length > 0;
    empty.style.display = has ? 'none' : '';
    count.textContent   = has ? `${this.palette.length}` : '';

    this.palette.forEach(color => {
      const sw = document.createElement('div');
      sw.className = 'palette-swatch';
      sw.style.background = color;
      sw.title = `${color} — click to copy, right-click to remove`;
      sw.addEventListener('click', () => {
        navigator.clipboard.writeText(color);
        this._showResult(this.panel, color);
        sw.classList.add('copied');
        setTimeout(() => sw.classList.remove('copied'), 300);
      });
      sw.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.palette = this.palette.filter(c => c !== color);
        this._savePalette();
        this._renderPalette();
      });
      grid.appendChild(sw);
    });
  }

  _positionPanel() {
    if (!this.panel) return;
    const rail = this.tb.rail.getBoundingClientRect();
    const p    = this.tb.placement;
    const gap  = 12;
    const M    = 8;

    Object.assign(this.panel.style, { top: '0px', left: '0px' });
    const pw = this.panel.getBoundingClientRect().width;
    const ph = this.panel.getBoundingClientRect().height;

    let top, left;
    if (p === 'left')        { left = rail.right + gap;      top  = rail.top; }
    else if (p === 'right')  { left = rail.left - pw - gap;  top  = rail.top; }
    else if (p === 'top')    { top  = rail.bottom + gap;     left = rail.right - pw; }
    else                     { top  = rail.top - ph - gap;   left = rail.right - pw; }

    left = Math.max(M, Math.min(left, window.innerWidth  - pw - M));
    top  = Math.max(M, Math.min(top,  window.innerHeight - ph - M));
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); }

  // ── Color conversion helpers ──
  _hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        default: h = ((r - g) / d + 4) / 6;
      }
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
}
