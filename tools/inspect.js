import { isArgus } from './utils.js';

function _shorthand(t, r, b, l) {
  if (t === '0px' && r === '0px' && b === '0px' && l === '0px') return '—';
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return `${t} ${r}`;
  return `${t} ${r} ${b} ${l}`;
}

export class InspectTool {
  constructor(toolbar) {
    this.tb              = toolbar;
    this.hoverHighlight  = null;
    this.pinnedHighlight = null;
    this.pinnedEl        = null;
    this.panel           = null;
    this._pill           = null;
    this._active         = false;
    this._currentHover   = null;
    this._onMove         = this._onMouseMove.bind(this);
    this._onClick        = this._onMouseClick.bind(this);
  }

  activate() {
    if (this._active) return; // guard against double-activate orphaning prior highlights
    this._active = true;
    this._createHighlights();
    this._onScroll = () => {
      if (this.pinnedEl)       this._placeEl(this.pinnedHighlight, this.pinnedEl);
      if (this._currentHover)  this._placeEl(this.hoverHighlight,  this._currentHover);
      if (this.pinnedEl && this.panel) this._positionPanel(this.pinnedEl);
      if (this._currentHover) this._placePill(this._currentHover);
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

    this._pill = document.createElement('button');
    this._pill.className = 'argus-inspect-pill';
    this._pill.style.display = 'none';
    this._pill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this._currentHover) this._pinTarget(this._currentHover);
    });
    this.tb.shadow.appendChild(this._pill);
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
    this._pill?.remove();
    this.hoverHighlight = this.pinnedHighlight = this._pill = null;
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
    this._placeEl(this.hoverHighlight, target);
    this._currentHover = target;
    this._showPill(target);
  }

  _onMouseClick(e) {
    if (!this._active || isArgus(e.target, this.tb.shadow)) return;
    e.preventDefault();
    e.stopPropagation();
    const target = this._realTarget(e.target);
    if (!target) return;
    this._pinTarget(target);
  }

  /** Pin an element: show green highlight + properties panel. Toggle off if same element. */
  _pinTarget(target) {
    if (this.pinnedEl === target) {
      this.pinnedEl = null;
      this.pinnedHighlight.style.display = 'none';
      this._removePanel();
      this._showPill(this._currentHover);
      return;
    }
    this.pinnedEl = target;
    this._placeEl(this.pinnedHighlight, target);
    this.pinnedHighlight.style.display = 'block';
    this._showPanel(target);
  }

  // ── Inspect pill ──
  _showPill(target) {
    if (!this._pill || !target) return;
    this._pill.textContent = `<${target.tagName.toLowerCase()}>`;
    this._placePill(target);
    this._pill.style.display = 'flex';
  }

  _hidePill() {
    if (this._pill) this._pill.style.display = 'none';
  }

  _placePill(target) {
    if (!this._pill || !target) return;
    const r  = target.getBoundingClientRect();
    const ph = 20;
    let top  = r.top - ph / 2;
    let left = r.left + 4;
    top  = Math.max(4, Math.min(top,  window.innerHeight - ph - 4));
    left = Math.max(4, Math.min(left, window.innerWidth  - 80 - 4));
    Object.assign(this._pill.style, { top: `${top}px`, left: `${left}px` });
  }

  // ── Panel ──
  _showPanel(el) {
    this._removePanel();

    const cs  = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const cls = [...el.classList].join(' ') || '—';

    const textColor  = cs.color;
    const bgColor    = cs.backgroundColor;
    const fontSize   = cs.fontSize;
    const fontWeight = cs.fontWeight;
    const fontFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();

    const pad = _shorthand(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft);
    const mar = _shorthand(cs.marginTop,  cs.marginRight,  cs.marginBottom,  cs.marginLeft);

    const row  = (k, v, swatch) => `
      <div class="panel-row">
        <span class="panel-key">${k}</span>
        <span class="panel-val" style="display:flex;align-items:center;gap:5px;">
          ${swatch ? `<span class="swatch" style="background:${swatch};"></span>` : ''}${v}
        </span>
      </div>`;

    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;
    p.innerHTML = `
      <div class="panel-label">Inspect</div>
      <div class="panel-row">
        <span class="panel-key">Tag</span>
        <span class="panel-val">&lt;${tag}&gt;</span>
      </div>
      <div class="panel-row panel-row--block">
        <span class="panel-key">Class</span>
        <span class="panel-val panel-val--wrap">${cls}</span>
      </div>
      ${row('Font',   fontFamily)}
      ${row('Size',   fontSize)}
      ${row('Weight', fontWeight)}
      ${row('Color',  textColor,  textColor)}
      ${row('BG',     bgColor,    bgColor)}
      <div class="inspect-section-label">Spacing</div>
      ${row('Padding', pad)}
      ${row('Margin',  mar)}
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
