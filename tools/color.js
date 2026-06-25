export class ColorTool {
  constructor(toolbar) {
    this.tb        = toolbar;
    this.panel     = null;
    this.mode      = 'text'; // 'text' | 'bg'
    this.palette   = [];
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

  activate() { this._showPanel(); }

  deactivate() {
    this.panel?.remove();
    this.panel = null;
  }

  destroy() { this.deactivate(); }

  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;

    p.innerHTML = `
      <div class="panel-label">Color</div>
      <div class="color-mode-row">
        <button class="color-mode-btn ${this.mode === 'text' ? 'active' : ''}" data-mode="text">Text</button>
        <button class="color-mode-btn ${this.mode === 'bg'   ? 'active' : ''}" data-mode="bg">Background</button>
      </div>
      <button class="eyedropper-btn">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8"/></svg>
        Pick color
      </button>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div class="palette-label">Palette</div>
        <div id="argus-picked" style="font-size:11.5px;font-weight:600;opacity:0.7;display:flex;align-items:center;gap:5px;"></div>
      </div>
      <div class="palette-grid"></div>
      <div class="palette-empty" style="display:none;">No saved colors yet.</div>
    `;

    p.querySelectorAll('.color-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.mode;
        p.querySelectorAll('.color-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === this.mode));
      });
    });

    p.querySelector('.eyedropper-btn').addEventListener('click', () => this._pick(p));

    this.panel = p;
    this.tb.shadow.appendChild(p);
    this._renderPalette();
    this._positionPanel();
  }

  async _pick(p) {
    if (!window.EyeDropper) {
      alert('EyeDropper API not supported in this browser.');
      return;
    }
    try {
      const dropper = new EyeDropper();
      const result  = await dropper.open();
      const color   = result.sRGBHex;

      // Show picked color
      const pickedEl = p.querySelector('#argus-picked');
      pickedEl.innerHTML = `
        <span class="swatch" style="background:${color};width:12px;height:12px;border-radius:3px;"></span>
        ${color}
        <button style="border:none;background:rgba(33,112,244,0.12);color:#2170F4;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Save</button>
      `;
      pickedEl.querySelector('button').addEventListener('click', () => this._saveColor(color));

    } catch {
      // User cancelled
    }
  }

  _saveColor(color) {
    if (!this.palette.includes(color)) {
      this.palette.unshift(color);
      if (this.palette.length > 24) this.palette.pop();
      this._savePalette();
      this._renderPalette();
    }
  }

  _renderPalette() {
    if (!this.panel) return;
    const grid  = this.panel.querySelector('.palette-grid');
    const empty = this.panel.querySelector('.palette-empty');
    grid.innerHTML = '';
    empty.style.display = this.palette.length ? 'none' : 'block';

    this.palette.forEach(color => {
      const sw = document.createElement('div');
      sw.className = 'palette-swatch';
      sw.style.background = color;
      sw.title = color;
      sw.addEventListener('click', () => {
        // Copy to clipboard
        navigator.clipboard.writeText(color);
        sw.style.transform = 'scale(1.3)';
        setTimeout(() => sw.style.transform = '', 200);
      });
      // Right-click to delete
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
    let top, left;

    if (p === 'left')   { left = rail.right + gap; top = rail.top; }
    else if (p === 'right')  { left = rail.left - 260 - gap; top = rail.top; }
    else if (p === 'top')    { top = rail.bottom + gap; left = Math.max(8, rail.right - 260); }
    else                     { top = rail.top - 240 - gap; left = Math.max(8, rail.right - 260); }

    top  = Math.max(8, Math.min(top,  window.innerHeight - 300));
    left = Math.max(8, Math.min(left, window.innerWidth  - 268));

    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); }
}
