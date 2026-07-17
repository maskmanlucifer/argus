import { isArgus } from './utils.js';

const PANEL_REST_DELAY = 220; // ms the cursor must rest on an element before its panel appears

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
    this.panel           = null;
    this._active         = false;
    this._currentHover   = null;
    this._pendingHover   = null;
    this._panelTimer     = null;
    this._onMove         = this._onMouseMove.bind(this);
    this._onClick        = this._onClick.bind(this);
  }

  activate() {
    if (this._active) return; // guard against double-activate orphaning prior highlights
    this._active = true;
    this._createHighlight();
    this._onScroll = () => {
      if (this._currentHover) {
        this._placeEl(this.hoverHighlight, this._currentHover);
        if (this.panel) this._positionPanel(this._currentHover);
      }
    };
    document.addEventListener('mousemove', this._onMove, true);
    document.addEventListener('click', this._onClick, true);
    window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this._onScroll);
  }

  deactivate() {
    this._active = false;
    document.removeEventListener('mousemove', this._onMove, true);
    document.removeEventListener('click', this._onClick, true);
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onScroll);
    clearTimeout(this._panelTimer);
    this._pendingHover = null;
    this._removeHighlight();
    this._removePanel();
    this._currentHover = null;
  }

  // Inspect is look-don't-touch: swallow clicks on real page content so an
  // accidental click while inspecting doesn't navigate away or submit a form.
  _onClick(e) {
    if (!this._active || isArgus(e.target, this.tb.shadow)) return;
    e.preventDefault();
    e.stopPropagation();
  }

  destroy() { this.deactivate(); }

  // ── Highlight ──
  _createHighlight() {
    this.hoverHighlight = document.createElement('div');
    this.hoverHighlight.className = 'argus-highlight';
    this.tb.shadow.appendChild(this.hoverHighlight);
  }

  _removeHighlight() {
    this.hoverHighlight?.remove();
    this.hoverHighlight = null;
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

  // ── Mouse handler ──
  _onMouseMove(e) {
    if (!this._active) return;
    const target = this._realTarget(e.target);
    if (!target) return; // hovering our own UI (e.g. the panel) — leave everything as-is, so Copy CSS stays clickable

    // The panel sits in the small gap just outside the highlighted element.
    // Crossing that gap still passes over real page content underneath, which
    // would otherwise switch the target mid-transit and yank the panel away
    // right as the cursor is heading for it. Treat the cursor as still "on"
    // the current element while it's anywhere inside the box spanning the
    // element and the panel together.
    if (this.panel && this._currentHover && target !== this._currentHover && this._isInBridge(e)) return;

    this._placeEl(this.hoverHighlight, target);
    this._currentHover = target;

    // Only refresh the panel once the cursor rests on an element — otherwise
    // quick passes through intervening elements (e.g. a card's ancestors on
    // the way out to the body) repeatedly flash the panel to whatever's
    // fleetingly under the cursor.
    if (target === this._pendingHover) return;
    this._pendingHover = target;
    clearTimeout(this._panelTimer);
    this._panelTimer = setTimeout(() => {
      if (this._currentHover === target) this._showPanel(target);
    }, PANEL_REST_DELAY);
  }

  _isInBridge(e) {
    const m  = 12;
    const pr = this.panel.getBoundingClientRect();
    return e.clientX >= pr.left - m && e.clientX <= pr.right  + m &&
           e.clientY >= pr.top  - m && e.clientY <= pr.bottom + m;
  }

  // ── Panel — reuses one persistent node so the entrance animation doesn't
  // replay (and the panel doesn't flicker/jump) on every hover update ──
  _showPanel(el) {
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

    if (!this.panel) {
      this.panel = document.createElement('div');
      this.tb.shadow.appendChild(this.panel);
    }
    this.panel.className = `argus-panel inspect-panel theme-${this.tb.theme}`;
    this.panel.innerHTML = `
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

    this.panel.querySelector('.panel-copy-btn').addEventListener('click', () => this._copyCss(el, this.panel));
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
    this.panel?.setAttribute('class', `argus-panel inspect-panel theme-${theme}`);
  }

  setPlacement() {
    if (this._currentHover) this._positionPanel(this._currentHover);
  }
}
