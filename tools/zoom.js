export class ZoomTool {
  constructor(toolbar) {
    this.tb     = toolbar;
    this._active = false;
    this.panel   = null;
    this._zoom   = 1.0;
  }

  activate() {
    this._active = true;
    this._showPanel();
  }

  deactivate() {
    this._active = false;
    this.panel?.remove();
    this.panel = null;
    this._clearZoom();
    this._zoom = 1.0;
  }

  /**
   * Resets the page zoom when the inspector is fully closed.
   */
  destroy() {
    this.deactivate();
    this._clearZoom();
  }

  _clearZoom() {
    document.body.style.transform = '';
    document.body.style.transformOrigin = '';
  }

  onEsc() {}

  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;
    p.style.width = '140px';
    this._renderPanel(p);
    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel();
  }

  _renderPanel(p) {
    const pct = Math.round(this._zoom * 100);
    p.innerHTML = `
      <div class="panel-label">Zoom</div>
      <div class="zoom-level-display">${pct}%</div>
      <div class="zoom-controls">
        <button class="zoom-step-btn" id="argus-zoom-out"${pct <= 25 ? ' disabled' : ''}>−</button>
        <button class="zoom-step-btn" id="argus-zoom-in"${pct >= 300 ? ' disabled' : ''}>+</button>
      </div>
      <button class="zoom-reset-btn"${pct === 100 ? ' disabled' : ''}>Reset to 100%</button>
    `;
    p.querySelector('#argus-zoom-out').addEventListener('click', () => this._step(-0.1));
    p.querySelector('#argus-zoom-in').addEventListener('click', () => this._step(0.1));
    p.querySelector('.zoom-reset-btn').addEventListener('click', () => this._set(1.0));
  }

  _step(delta) { this._set(this._zoom + delta); }

  _set(level) {
    this._zoom = Math.max(0.25, Math.min(3.0, Math.round(level * 10) / 10));
    if (this._zoom === 1.0) {
      this._clearZoom();
    } else {
      document.body.style.transformOrigin = 'top center';
      document.body.style.transform = `scale(${this._zoom})`;
    }
    if (this.panel) {
      this._renderPanel(this.panel);
      this._positionPanel();
    }
  }

  _positionPanel() {
    if (!this.panel) return;
    const rail = this.tb.rail.getBoundingClientRect();
    const p    = this.tb.placement;
    const gap  = 6;
    const M    = 8;

    Object.assign(this.panel.style, { top: '0px', left: '0px' });
    const pw = this.panel.getBoundingClientRect().width;
    const ph = this.panel.getBoundingClientRect().height;

    let top, left;
    if (p === 'left')        { left = rail.right + gap;     top  = rail.top; }
    else if (p === 'right')  { left = rail.left - pw - gap; top  = rail.top; }
    else if (p === 'top')    { top  = rail.bottom + gap;    left = rail.right - pw; }
    else                     { top  = rail.top - ph - gap;  left = rail.right - pw; }

    left = Math.max(M, Math.min(left, window.innerWidth  - pw - M));
    top  = Math.max(M, Math.min(top,  window.innerHeight - ph - M));
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  setTheme(theme)    { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()     { this._positionPanel(); }
}
