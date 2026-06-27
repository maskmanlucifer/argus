import { isArgus } from './utils.js';

const HOVER_DELAY = 900; // ms before panel shows on hover dwell

export class InspectTool {
  constructor(toolbar) {
    this.tb             = toolbar;
    this.hoverHighlight = null; // blue — follows mouse always
    this.pinnedHighlight = null; // green — stays on clicked element
    this.pinnedEl       = null;
    this.panel          = null;
    this._active        = false;
    this._currentHover  = null;
    this._hoverTimer    = null;
    this._onMove        = this._onMouseMove.bind(this);
    this._onClick       = this._onMouseClick.bind(this);
  }

  activate() {
    if (this._active) return; // guard against double-activate orphaning prior highlights
    this._active = true;
    this._createHighlights();
    this._onScroll = () => {
      if (this.pinnedEl)        this._placeEl(this.pinnedHighlight, this.pinnedEl);
      if (this._currentHover)   this._placeEl(this.hoverHighlight,  this._currentHover);
      if (this.pinnedEl && this.panel) this._positionPanel(this.pinnedEl);
    };
    document.addEventListener('mousemove', this._onMove,   true);
    document.addEventListener('click',     this._onClick,  true);
    window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this._onScroll);
  }

  deactivate() {
    this._active = false;
    clearTimeout(this._hoverTimer);
    this._hoverTimer = null;
    document.removeEventListener('mousemove', this._onMove,  true);
    document.removeEventListener('click',     this._onClick, true);
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onScroll);
    this._removeHighlights();
    this._removePanel();
    this.pinnedEl     = null;
    this._currentHover = null;
  }

  destroy() { this.deactivate(); }

  onEsc() {
    if (this.pinnedEl) {
      this.pinnedEl = null;
      this._currentHover = null; // clear so next hover on the same element re-opens panel
      if (this.pinnedHighlight) this.pinnedHighlight.style.display = 'none';
      this._removePanel();
    }
  }

  // ── Highlights ──
  _createHighlights() {
    this.hoverHighlight  = this._makeHighlight('argus-highlight');
    this.pinnedHighlight = this._makeHighlight('argus-highlight pinned');
    this.pinnedHighlight.style.display = 'none';
  }

  _makeHighlight(className) {
    const el = document.createElement('div');
    el.className = className;
    this.tb.shadow.appendChild(el);
    return el;
  }

  _removeHighlights() {
    this.hoverHighlight?.remove();
    this.pinnedHighlight?.remove();
    this.hoverHighlight = this.pinnedHighlight = null;
  }

  _placeEl(el, target) {
    if (!el || !target) return;
    const r = target.getBoundingClientRect();
    Object.assign(el.style, {
      top:     `${r.top}px`,
      left:    `${r.left}px`,
      width:   `${r.width}px`,
      height:  `${r.height}px`,
      display: 'block',
    });
  }

  // ── Mouse handlers ──
  _onMouseMove(e) {
    if (!this._active) return;
    const target = this._realTarget(e.target);
    if (!target) return;

    // Blue hover highlight always follows the cursor
    this._placeEl(this.hoverHighlight, target);

    if (this._currentHover === target) return;
    this._currentHover = target;

    // Don't update panel while an element is pinned
    if (this.pinnedEl) return;

    clearTimeout(this._hoverTimer);

    if (this.panel) {
      // Panel already open in hover mode — update instantly as cursor moves
      this._showPanel(target);
    } else {
      // First dwell — wait before showing panel
      this._hoverTimer = setTimeout(() => {
        if (this._currentHover === target && this._active && !this.pinnedEl) {
          this._showPanel(target);
        }
      }, HOVER_DELAY);
    }
  }

  _onMouseClick(e) {
    if (!this._active || isArgus(e.target, this.tb.shadow)) return;
    e.preventDefault();
    e.stopPropagation();

    const target = this._realTarget(e.target);
    if (!target) return;

    clearTimeout(this._hoverTimer);

    if (this.pinnedEl === target) {
      // Unpin — go back to hover mode
      this.pinnedEl = null;
      this.pinnedHighlight.style.display = 'none';
      this._removePanel();
      return;
    }

    // Pin this element
    this.pinnedEl = target;
    this._placeEl(this.pinnedHighlight, target);
    this.pinnedHighlight.style.display = 'block';
    this._showPanel(target);
  }

  // ── Panel ──
  _showPanel(el) {
    this._removePanel();

    const cs = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const cls = [...el.classList].slice(0, 3).join(' ') || '—';

    const textColor  = cs.color;
    const bgColor    = cs.backgroundColor;
    const fontSize   = cs.fontSize;
    const fontWeight = cs.fontWeight;
    const fontFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

    const rows = [
      { k: 'Tag',    v: `&lt;${tag}&gt;` },
      { k: 'Class',  v: cls || '—' },
      { k: 'Font',   v: fontFamily },
      { k: 'Size',   v: fontSize },
      { k: 'Weight', v: fontWeight },
      { k: 'Color',  v: textColor,  swatch: textColor },
      { k: 'BG',     v: bgColor,    swatch: bgColor },
    ];

    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;
    p.innerHTML = `
      <div class="panel-label">Inspect${this.pinnedEl ? ' · pinned' : ''}</div>
      ${rows.map(r => `
        <div class="panel-row">
          <span class="panel-key">${r.k}</span>
          <span class="panel-val" style="display:flex;align-items:center;gap:5px;">
            ${r.swatch ? `<span class="swatch" style="background:${r.swatch};"></span>` : ''}
            ${r.v}
          </span>
        </div>`).join('')}
      <button class="panel-copy-btn">Copy CSS</button>
    `;

    p.querySelector('.panel-copy-btn').addEventListener('click', () => this._copyCss(el, p));
    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel(el);
  }

  _positionPanel(el) {
    if (!this.panel) return;
    const r   = el.getBoundingClientRect();
    const pw  = 220;
    const gap = 6;
    const placement = this.tb.placement;

    let top, left;
    if (placement === 'left') {
      left = r.right + gap; top = r.top;
    } else if (placement === 'right') {
      left = r.left - pw - gap; top = r.top;
    } else if (placement === 'top') {
      top = r.bottom + gap; left = r.left;
    } else {
      top = r.top - this.panel.offsetHeight - gap; left = r.left;
    }

    const ph = this.panel.offsetHeight;
    top  = Math.max(8, Math.min(top,  window.innerHeight - ph - 8));
    left = Math.max(8, Math.min(left, window.innerWidth  - pw - 8));

    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  _removePanel() {
    this.panel?.remove();
    this.panel = null;
  }

  // ── CSS copy ──
  _copyCss(el, panelEl) {
    const cs  = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const cls = el.className ? `.${[...el.classList].join('.')}` : '';
    const snippet = [
      `${tag}${cls} {`,
      `  font-family: ${cs.fontFamily};`,
      `  font-size: ${cs.fontSize};`,
      `  font-weight: ${cs.fontWeight};`,
      `  color: ${cs.color};`,
      `  background-color: ${cs.backgroundColor};`,
      `}`,
    ].join('\n');

    navigator.clipboard.writeText(snippet).then(() => {
      const btn = panelEl.querySelector('.panel-copy-btn');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy CSS'; btn.classList.remove('copied'); }, 1500);
    });
  }

  // ── Helpers ──
  _realTarget(el) {
    if (!el || el === document.documentElement || el === document.body) return null;
    if (isArgus(el, this.tb.shadow)) return null;
    return el;
  }

  setTheme(theme) {
    this.panel?.setAttribute('class', `argus-panel theme-${theme}`);
  }

  setPlacement() {
    const target = this.pinnedEl || this._currentHover;
    if (target) this._positionPanel(target);
  }
}
