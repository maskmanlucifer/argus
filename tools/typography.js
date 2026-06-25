export class TypographyTool {
  constructor(toolbar) {
    this.tb      = toolbar;
    this.panel   = null;
    this.hl      = null;
    this._active = false;
    this._onMove = this._onMouseMove.bind(this);
  }

  activate() {
    this._active = true;
    this._createHighlight();
    document.addEventListener('mousemove', this._onMove, true);
  }

  deactivate() {
    this._active = false;
    document.removeEventListener('mousemove', this._onMove, true);
    this._removeHighlight();
    this._removePanel();
  }

  destroy() { this.deactivate(); }

  _createHighlight() {
    const el = document.createElement('div');
    el.className = 'argus-highlight';
    this.tb.shadow.appendChild(el);
    this.hl = el;
  }

  _removeHighlight() { this.hl?.remove(); this.hl = null; }
  _removePanel()     { this.panel?.remove(); this.panel = null; }

  _onMouseMove(e) {
    if (!this._active) return;
    const target = this._realTarget(e.target);
    if (!target) { this._removePanel(); return; }

    const r = target.getBoundingClientRect();
    Object.assign(this.hl.style, {
      top: `${r.top}px`, left: `${r.left}px`,
      width: `${r.width}px`, height: `${r.height}px`,
    });

    const cs = window.getComputedStyle(target);
    const family = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    const size   = cs.fontSize;
    const weight = cs.fontWeight;

    if (!this.panel) {
      this.panel = document.createElement('div');
      this.panel.className = `argus-panel theme-${this.tb.theme}`;
      this.tb.shadow.appendChild(this.panel);
    }

    this.panel.innerHTML = `
      <div class="panel-label">Typography</div>
      <div class="panel-row"><span class="panel-key">Family</span><span class="panel-val">${family}</span></div>
      <div class="panel-row"><span class="panel-key">Size</span><span class="panel-val">${size}</span></div>
      <div class="panel-row"><span class="panel-key">Weight</span><span class="panel-val">${weight}</span></div>
    `;

    // Position near cursor
    const gap = 14;
    let top  = e.clientY + gap;
    let left = e.clientX + gap;
    if (top  + 120 > window.innerHeight) top  = e.clientY - 120 - gap;
    if (left + 260 > window.innerWidth)  left = e.clientX - 260 - gap;
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  _realTarget(el) {
    if (!el || el === document.documentElement || el === document.body) return null;
    if (el?.getRootNode?.() === this.tb.shadow) return null;
    if (el?.closest?.('#argus-host')) return null;
    return el;
  }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
}
