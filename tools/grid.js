const COL_PRESETS = [4, 8, 12, 16];
const COL_HUE     = '99,102,241';
const BASE_HUE    = '99,102,241';
const STORAGE_KEY = 'argus_grid_configs';

export class GridTool {
  constructor(toolbar) {
    this.tb      = toolbar;
    this._active = false;
    this.panel   = null;

    this._overlayCol  = null;
    this._overlayBase = null;

    this._mode      = 'both';
    this._cols      = 12;
    this._gutter    = 20;
    this._margin    = 24;
    this._maxWidth  = 0;
    this._baseSize  = 8;
    this._opacity   = 40;
    this._saved     = [];   // [{name, cols, gutter, margin, maxWidth, baseSize}]
  }

  activate() {
    this._active = true;
    this._createOverlays();
    this._onResize = () => this._updateOverlays();
    window.addEventListener('resize', this._onResize);
    chrome.storage.local.get(STORAGE_KEY).then(data => {
      this._saved = data[STORAGE_KEY] || [];
      const def = this._saved.find(c => c.isDefault);
      if (def) this._applyConfig(def);
      this._updateOverlays();
      this._showPanel();
    }).catch(() => { this._updateOverlays(); this._showPanel(); });
  }

  deactivate() {
    this._active = false;
    window.removeEventListener('resize', this._onResize);
    this._overlayCol?.remove();
    this._overlayBase?.remove();
    this._overlayCol = this._overlayBase = null;
    this.panel?.remove();
    this.panel = null;
  }

  destroy() { this.deactivate(); }
  onEsc()   {}

  // ── Storage ──
  _persistSaved() {
    chrome.storage.local.set({ [STORAGE_KEY]: this._saved }).catch(() => {});
  }

  _applyConfig(cfg) {
    this._cols     = cfg.cols;
    this._gutter   = cfg.gutter;
    this._margin   = cfg.margin;
    this._maxWidth = cfg.maxWidth;
    this._baseSize = cfg.baseSize;
  }

  // ── Overlays ──
  _createOverlays() {
    this._overlayCol  = this._makeOverlay();
    this._overlayBase = this._makeOverlay();
  }

  _makeOverlay() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483644;';
    this.tb.shadow.appendChild(el);
    return el;
  }

  _updateOverlays() {
    const showCol  = this._mode !== 'baseline';
    const showBase = this._mode !== 'columns';
    const a        = this._opacity / 100;

    this._overlayCol.style.display  = showCol  ? 'block' : 'none';
    this._overlayBase.style.display = showBase ? 'block' : 'none';

    if (showCol)  this._overlayCol.style.backgroundImage  = this._buildColGradient(window.innerWidth, a);
    if (showBase) {
      const s    = this._baseSize;
      const rgba = `rgba(${BASE_HUE},${(a * 0.55).toFixed(2)})`;
      this._overlayBase.style.backgroundImage =
        `repeating-linear-gradient(to bottom,transparent 0px,transparent ${s - 1}px,${rgba} ${s - 1}px,${rgba} ${s}px)`;
    }
  }

  _buildColGradient(vw, a) {
    const { _cols: cols, _gutter: g, _margin: m, _maxWidth: mw } = this;
    const containerW = mw > 0 ? Math.min(mw, vw) : vw;
    const offsetX    = Math.round((vw - containerW) / 2);
    const colW       = (containerW - 2 * m - (cols - 1) * g) / cols;
    if (colW <= 0) return 'none';

    const col   = `rgba(${COL_HUE},${(a * 0.35).toFixed(2)})`;
    const stops = [`transparent 0px`, `transparent ${offsetX + m}px`];
    let x = offsetX + m;
    for (let i = 0; i < cols; i++) {
      stops.push(`${col} ${x}px`, `${col} ${x + colW}px`, `transparent ${x + colW}px`);
      x += colW + g;
      stops.push(`transparent ${x}px`);
    }
    stops.push(`transparent 100%`);
    return `linear-gradient(to right,${stops.join(',')})`;
  }

  // ── Panel ──
  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;
    p.style.width = '220px';
    this._renderPanel(p);
    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel();
  }

  _renderPanel(p) {
    const showCol  = this._mode !== 'baseline';
    const showBase = this._mode !== 'columns';

    p.innerHTML = `
      <div class="panel-label">Grid</div>

      ${this._saved.length ? `
        <div class="grid-saved-list">
          ${this._saved.map(c => `
            <div class="grid-saved-pill${c.isDefault ? ' grid-saved-default' : ''}">
              <button class="grid-saved-apply" data-name="${c.name}">${c.name}</button>
              <button class="grid-saved-star"  data-name="${c.name}" title="Open by default">${c.isDefault ? '★' : '☆'}</button>
              <button class="grid-saved-del"   data-name="${c.name}">×</button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="grid-mode-row" style="margin-top:${this._saved.length ? 8 : 0}px;">
        ${[['columns','Columns'],['baseline','Baseline'],['both','Both']].map(([m,l]) =>
          `<button class="grid-mode-btn${this._mode === m ? ' active' : ''}" data-mode="${m}">${l}</button>`
        ).join('')}
      </div>

      ${showCol ? `
        <div class="inspect-section-label" style="margin-top:10px;">Columns</div>
        <div class="grid-col-presets">
          ${COL_PRESETS.map(n =>
            `<button class="grid-col-btn${this._cols === n ? ' active' : ''}" data-cols="${n}">${n}</button>`
          ).join('')}
        </div>
        <div class="grid-inputs">
          <div class="grid-input-group">
            <span class="grid-input-label">Gutter</span>
            <div class="grid-input-wrap">
              <input class="grid-input" data-key="gutter" type="number" min="0" max="120" value="${this._gutter}">
              <span class="grid-input-unit">px</span>
            </div>
          </div>
          <div class="grid-input-group">
            <span class="grid-input-label">Margin</span>
            <div class="grid-input-wrap">
              <input class="grid-input" data-key="margin" type="number" min="0" max="200" value="${this._margin}">
              <span class="grid-input-unit">px</span>
            </div>
          </div>
          <div class="grid-input-group">
            <span class="grid-input-label">Max Width</span>
            <div class="grid-input-wrap">
              <input class="grid-input" data-key="maxWidth" type="number" min="0" max="3840" value="${this._maxWidth || ''}" placeholder="—">
              <span class="grid-input-unit">px</span>
            </div>
          </div>
        </div>
      ` : ''}

      ${showBase ? `
        <div class="inspect-section-label" style="margin-top:${showCol ? 4 : 10}px;">Baseline</div>
        <div class="grid-inputs">
          <div class="grid-input-group">
            <span class="grid-input-label">Unit</span>
            <div class="grid-input-wrap">
              <input class="grid-input" data-key="baseSize" type="number" min="2" max="64" value="${this._baseSize}">
              <span class="grid-input-unit">px</span>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="inspect-section-label" style="margin-top:${showCol || showBase ? 4 : 10}px;">Opacity</div>
      <div class="grid-opacity-row">
        <input class="grid-opacity-slider" type="range" min="10" max="100" step="5" value="${this._opacity}">
        <span class="grid-opacity-val">${this._opacity}%</span>
      </div>

      <div class="grid-save-row">
        <input class="grid-save-input" type="text" placeholder="Name this config…" maxlength="24">
        <button class="grid-save-btn">Save</button>
      </div>
    `;

    // Saved config — apply
    p.querySelectorAll('.grid-saved-apply').forEach(btn =>
      btn.addEventListener('click', () => {
        const cfg = this._saved.find(c => c.name === btn.dataset.name);
        if (!cfg) return;
        this._applyConfig(cfg);
        this._renderPanel(p);
        this._updateOverlays();
        this._positionPanel();
      })
    );

    // Saved config — set default
    p.querySelectorAll('.grid-saved-star').forEach(btn =>
      btn.addEventListener('click', () => {
        const name    = btn.dataset.name;
        const wasDefault = this._saved.find(c => c.name === name)?.isDefault;
        this._saved = this._saved.map(c => ({ ...c, isDefault: c.name === name ? !wasDefault : false }));
        this._persistSaved();
        if (!wasDefault) {
          const cfg = this._saved.find(c => c.name === name);
          if (cfg) { this._applyConfig(cfg); this._updateOverlays(); }
        }
        this._renderPanel(p);
        this._positionPanel();
      })
    );

    // Saved config — delete
    p.querySelectorAll('.grid-saved-del').forEach(btn =>
      btn.addEventListener('click', () => {
        this._saved = this._saved.filter(c => c.name !== btn.dataset.name);
        this._persistSaved();
        this._renderPanel(p);
        this._positionPanel();
      })
    );

    // Mode toggle
    p.querySelectorAll('.grid-mode-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        this._mode = btn.dataset.mode;
        this._renderPanel(p);
        this._updateOverlays();
        this._positionPanel();
      })
    );

    // Column count presets
    p.querySelectorAll('.grid-col-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        this._cols = Number(btn.dataset.cols);
        this._renderPanel(p);
        this._updateOverlays();
        this._positionPanel();
      })
    );

    // Number inputs
    p.querySelectorAll('.grid-input').forEach(input => {
      const commit = () => {
        const raw = Number(input.value) || 0;
        if (input.dataset.key === 'gutter')   this._gutter   = Math.max(0, Math.min(120,  raw));
        if (input.dataset.key === 'margin')   this._margin   = Math.max(0, Math.min(200,  raw));
        if (input.dataset.key === 'maxWidth') this._maxWidth = raw > 0 ? Math.min(3840, raw) : 0;
        if (input.dataset.key === 'baseSize') this._baseSize = Math.max(2, Math.min(64,   raw));
        this._updateOverlays();
      };
      input.addEventListener('change', commit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
      input.addEventListener('focus', () => input.select());
    });

    // Opacity slider
    const slider   = p.querySelector('.grid-opacity-slider');
    const valLabel = p.querySelector('.grid-opacity-val');
    slider.addEventListener('input', () => {
      this._opacity = Number(slider.value);
      valLabel.textContent = `${this._opacity}%`;
      this._updateOverlays();
    });

    // Save
    const saveInput = p.querySelector('.grid-save-input');
    const saveBtn   = p.querySelector('.grid-save-btn');
    saveBtn.addEventListener('click', () => {
      const name = saveInput.value.trim();
      if (!name) return;
      const cfg = { name, cols: this._cols, gutter: this._gutter, margin: this._margin, maxWidth: this._maxWidth, baseSize: this._baseSize };
      this._saved = [...this._saved.filter(c => c.name !== name), cfg];
      this._persistSaved();
      this._renderPanel(p);
      this._positionPanel();
    });
    saveInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBtn.click(); } });
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
    if      (pl === 'left')  { left = rail.right + gap;     top  = rail.top; }
    else if (pl === 'right') { left = rail.left - pw - gap; top  = rail.top; }
    else if (pl === 'top')   { top  = rail.bottom + gap;    left = rail.right - pw; }
    else                     { top  = rail.top - ph - gap;  left = rail.right - pw; }

    left = Math.max(M, Math.min(left, window.innerWidth  - pw - M));
    top  = Math.max(M, Math.min(top,  window.innerHeight - ph - M));
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); }
}
