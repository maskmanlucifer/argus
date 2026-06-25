import { isArgus } from './utils.js';

export class InspectTool {
  constructor(toolbar) {
    this.tb = toolbar;
    this.highlight = null;
    this.pinnedEl  = null;
    this.panel     = null;
    this._active   = false;
    this._onMove   = this._onMouseMove.bind(this);
    this._onClick  = this._onMouseClick.bind(this);
  }

  activate() {
    this._active = true;
    this._createHighlight();
    this._onScroll = () => { if (this.pinnedEl) this._moveHighlight(this.pinnedEl); };
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
    this._removeHighlight();
    this._removePanel();
    this.pinnedEl = null;
  }

  destroy() { this.deactivate(); }

  // ── Highlight ──
  _createHighlight() {
    const el = document.createElement('div');
    el.className = 'argus-highlight';
    this.tb.shadow.appendChild(el);
    this.highlight = el;
  }

  _removeHighlight() {
    this.highlight?.remove();
    this.highlight = null;
  }

  _moveHighlight(target) {
    if (!this.highlight || !target) return;
    const r = target.getBoundingClientRect();
    Object.assign(this.highlight.style, {
      top:    `${r.top}px`,
      left:   `${r.left}px`,
      width:  `${r.width}px`,
      height: `${r.height}px`,
      display: 'block',
    });
  }

  _onMouseMove(e) {
    if (!this._active || this.pinnedEl) return;
    const target = this._realTarget(e.target);
    if (!target) return;
    this._moveHighlight(target);
  }

  _onMouseClick(e) {
    if (!this._active || isArgus(e.target, this.tb.shadow)) return;
    e.preventDefault();
    e.stopPropagation();

    const target = this._realTarget(e.target);
    if (!target) return;

    if (this.pinnedEl === target) {
      // Unpin
      this.pinnedEl = null;
      this.highlight.classList.remove('pinned');
      this._removePanel();
      return;
    }

    this.pinnedEl = target;
    this.highlight.classList.add('pinned');
    this._moveHighlight(target);
    this._showPanel(target);
  }

  // ── Panel ──
  _showPanel(el) {
    this._removePanel();

    const cs = window.getComputedStyle(el);
    const tag = el.tagName.toLowerCase();
    const cls = [...el.classList].slice(0, 3).join(' ') || '—';

    const textColor = cs.color;
    const bgColor   = cs.backgroundColor;
    const fontSize  = cs.fontSize;
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
    const gap = 6;
    const placement = this.tb.placement;

    let top, left;

    if (placement === 'left') {
      left = r.right + gap;
      top  = r.top;
    } else if (placement === 'right') {
      left = r.left - pw - gap;
      top  = r.top;
    } else if (placement === 'top') {
      top  = r.bottom + gap;
      left = r.left;
    } else {
      top  = r.top - this.panel.offsetHeight - gap;
      left = r.left;
    }

    // Clamp
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
    if (this.pinnedEl) this._positionPanel(this.pinnedEl);
  }
}
