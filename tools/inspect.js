import { isArgus } from './utils.js';

export class InspectTool {
  constructor(toolbar) {
    this.tb             = toolbar;
    this.hoverHighlight = null; // blue — follows mouse always
    this.pinnedHighlight = null; // green — stays on clicked element
    this.pinnedEl       = null;
    this.panel          = null;
    this._active        = false;
    this._currentHover  = null;
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
    this._currentHover = target;
  }

  _onMouseClick(e) {
    if (!this._active || isArgus(e.target, this.tb.shadow)) return;
    e.preventDefault();
    e.stopPropagation();

    const target = this._realTarget(e.target);
    if (!target) return;

    if (this.pinnedEl === target) {
      // Click same element again — close panel
      this.pinnedEl = null;
      this.pinnedHighlight.style.display = 'none';
      this._removePanel();
      return;
    }

    // Switch to this element (works whether or not a panel was already open)
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
      <div class="panel-label">Inspect</div>
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
    const ph  = this.panel.offsetHeight;
    const gap = 8;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    // Available space on each side of the element
    const space = {
      right:  vw - r.right - gap,
      left:   r.left - gap,
      bottom: vh - r.bottom - gap,
      top:    r.top - gap,
    };

    // Candidate placements: { side, fits, top, left }
    const candidates = [
      { side: 'right',  fits: space.right  >= pw && space.bottom + r.height >= ph,
        left: r.right + gap,
        top:  Math.max(8, Math.min(r.top, vh - ph - 8)) },
      { side: 'left',   fits: space.left   >= pw && space.bottom + r.height >= ph,
        left: r.left - pw - gap,
        top:  Math.max(8, Math.min(r.top, vh - ph - 8)) },
      { side: 'bottom', fits: space.bottom >= ph && space.right  + r.width  >= pw,
        left: Math.max(8, Math.min(r.left, vw - pw - 8)),
        top:  r.bottom + gap },
      { side: 'top',    fits: space.top    >= ph && space.right  + r.width  >= pw,
        left: Math.max(8, Math.min(r.left, vw - pw - 8)),
        top:  r.top - ph - gap },
    ];

    // Pick first side that fully fits; fall back to the side with most space
    const best = candidates.find(c => c.fits) ||
      candidates.reduce((a, b) => {
        const aSpace = a.side === 'right' || a.side === 'left' ? space[a.side] : space[a.side];
        const bSpace = b.side === 'right' || b.side === 'left' ? space[b.side] : space[b.side];
        return bSpace > aSpace ? b : a;
      });

    const top  = Math.max(8, Math.min(best.top,  vh - ph - 8));
    const left = Math.max(8, Math.min(best.left, vw - pw - 8));
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
