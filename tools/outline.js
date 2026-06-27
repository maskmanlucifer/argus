const STYLE_ID = 'argus-outline-style';

const SPACING_COLORS = ['#2170F4', '#E91E8C', '#16A085', '#E67E22', '#9B59B6'];

export class OutlineTool {
  constructor(toolbar) {
    this.tb            = toolbar;
    this.active        = false;
    this._parentColors = new WeakMap();
    this._colorCounter = 0;
    this._spacingEls   = [];
    this._onMouseOver  = null;
    this._onDocLeave   = null;
    this._debounceTimer = null;
  }

  activate() {
    this.active = !this.active;
    this._apply();
    if (this.active) {
      this._attachSpacingTracker();
    } else {
      this._detachSpacingTracker();
      this.tb._deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this._apply();
    this._detachSpacingTracker();
  }

  destroy() { this.deactivate(); }

  _apply() {
    const existing = document.getElementById(STYLE_ID);
    if (this.active) {
      if (!existing) {
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `* { outline: 1px solid rgba(33,112,244,0.35) !important; }`;
        document.head.appendChild(style);
        this.tb.trackPageNode(style);
      }
    } else {
      existing?.remove();
    }
  }

  // ── Spacing tracker ──
  _attachSpacingTracker() {
    this._onMouseOver = (e) => {
      clearTimeout(this._debounceTimer);
      const el = e.target;
      this._debounceTimer = setTimeout(() => this._handleHover(el), 40);
    };
    this._onDocLeave = () => {
      clearTimeout(this._debounceTimer);
      this._clearSpacingOverlays();
    };
    document.addEventListener('mouseover', this._onMouseOver, true);
    document.documentElement.addEventListener('mouseleave', this._onDocLeave);
  }

  _handleHover(el) {
    if (!el || el === document.documentElement || el === document.body) return;
    if (el === this.tb.host) return;

    this._clearSpacingOverlays();

    const parent = el.parentElement;
    if (!parent || parent === document.documentElement) return;

    const hRect = el.getBoundingClientRect();
    if (!hRect.width || !hRect.height) return; // skip zero-width or zero-height elements

    // Orange highlight on the hovered element
    const hl = document.createElement('div');
    hl.className = 'argus-spacing-highlight';
    Object.assign(hl.style, {
      left:   `${hRect.left}px`,
      top:    `${hRect.top}px`,
      width:  `${hRect.width}px`,
      height: `${hRect.height}px`,
    });
    this.tb.shadow.appendChild(hl);
    this._spacingEls.push(hl);

    const color = this._getParentColor(parent);
    const dirs  = this._getLayoutDirs(parent);

    // Collect siblings visible in the viewport, caching their rects to avoid a
    // second getBoundingClientRect pass in _showSpacingMeasures (which would
    // force a second layout flush after the appendChild above).
    const siblings = [];
    for (const s of parent.children) {
      if (s === el) continue;
      const r = s.getBoundingClientRect();
      if ((r.width > 0 || r.height > 0)
          && r.bottom > 0 && r.top < window.innerHeight
          && r.right > 0 && r.left < window.innerWidth) {
        siblings.push({ el: s, rect: r });
      }
    }

    this._showSpacingMeasures(hRect, siblings, color, dirs);
  }

  _detachSpacingTracker() {
    clearTimeout(this._debounceTimer);
    if (this._onMouseOver) {
      document.removeEventListener('mouseover', this._onMouseOver, true);
      this._onMouseOver = null;
    }
    if (this._onDocLeave) {
      document.documentElement.removeEventListener('mouseleave', this._onDocLeave);
      this._onDocLeave = null;
    }
    this._clearSpacingOverlays();
  }

  _getParentColor(parent) {
    if (!this._parentColors.has(parent)) {
      this._parentColors.set(parent, SPACING_COLORS[this._colorCounter++ % SPACING_COLORS.length]);
    }
    return this._parentColors.get(parent);
  }

  // Decide which directions to measure based on the parent's layout mode.
  _getLayoutDirs(parent) {
    const cs = window.getComputedStyle(parent);
    const display = cs.display;
    const flexDir = cs.flexDirection || '';

    if (display === 'flex' || display === 'inline-flex') {
      return flexDir.includes('column') ? ['top', 'bottom'] : ['left', 'right'];
    }
    if (display === 'grid' || display === 'inline-grid') {
      return ['top', 'right', 'bottom', 'left'];
    }
    // block / inline-block → elements stack vertically by default
    return ['top', 'bottom'];
  }

  _showSpacingMeasures(hRect, siblings, color, dirs) {
    const MIN_GAP = 2;
    const MAX_GAP = 300;

    for (const dir of dirs) {
      let bestRect = null;
      let minGap   = Infinity;

      for (const sib of siblings) {
        const sRect = sib.rect; // rect cached in _handleHover filter pass
        let gap, hasOverlap;

        if (dir === 'top') {
          gap = hRect.top - sRect.bottom;
          hasOverlap = sRect.right > hRect.left && sRect.left < hRect.right;
        } else if (dir === 'bottom') {
          gap = sRect.top - hRect.bottom;
          hasOverlap = sRect.right > hRect.left && sRect.left < hRect.right;
        } else if (dir === 'left') {
          gap = hRect.left - sRect.right;
          hasOverlap = sRect.bottom > hRect.top && sRect.top < hRect.bottom;
        } else {
          gap = sRect.left - hRect.right;
          hasOverlap = sRect.bottom > hRect.top && sRect.top < hRect.bottom;
        }

        if (gap >= MIN_GAP && gap < minGap && gap <= MAX_GAP && hasOverlap) {
          minGap   = gap;
          bestRect = sRect;
        }
      }

      if (bestRect) this._renderMeasure(hRect, bestRect, dir, Math.round(minGap), color);
    }
  }

  _renderMeasure(hRect, sRect, dir, gap, color) {
    const isH = dir === 'left' || dir === 'right';
    const CAP = 5;

    let cx, cy, x1, y1, lineW, lineH;

    if (isH) {
      const overlapTop = Math.max(hRect.top, sRect.top);
      const overlapBot = Math.min(hRect.bottom, sRect.bottom);
      cy = (overlapTop + overlapBot) / 2;
      x1 = dir === 'left' ? sRect.right : hRect.right;
      cx = x1 + gap / 2;
      y1 = cy - 1;
      lineW = gap;
      lineH = 1;
    } else {
      const overlapLeft  = Math.max(hRect.left, sRect.left);
      const overlapRight = Math.min(hRect.right, sRect.right);
      cx = (overlapLeft + overlapRight) / 2;
      y1 = dir === 'top' ? sRect.bottom : hRect.bottom;
      cy = y1 + gap / 2;
      x1 = cx - 1;
      lineW = 1;
      lineH = gap;
    }

    const line = document.createElement('div');
    line.className = `argus-spacing-line ${isH ? 'horizontal' : 'vertical'}`;
    line.style.setProperty('--sc', color);
    Object.assign(line.style, {
      left: `${x1}px`, top: `${y1}px`,
      width: `${lineW}px`, height: `${lineH}px`,
    });

    const cap1 = document.createElement('div');
    const cap2 = document.createElement('div');
    cap1.className = cap2.className = 'argus-spacing-cap';
    cap1.style.setProperty('--sc', color);
    cap2.style.setProperty('--sc', color);
    if (isH) {
      Object.assign(cap1.style, { left: `${x1}px`,       top: `${cy - CAP}px`, width: '1px', height: `${CAP * 2}px` });
      Object.assign(cap2.style, { left: `${x1 + gap}px`, top: `${cy - CAP}px`, width: '1px', height: `${CAP * 2}px` });
    } else {
      Object.assign(cap1.style, { left: `${cx - CAP}px`, top: `${y1}px`,       width: `${CAP * 2}px`, height: '1px' });
      Object.assign(cap2.style, { left: `${cx - CAP}px`, top: `${y1 + gap}px`, width: `${CAP * 2}px`, height: '1px' });
    }

    const badge = document.createElement('div');
    badge.className = 'argus-spacing-badge';
    badge.textContent = `${isH ? '↔' : '↕'} ${gap}px`;
    badge.style.setProperty('--sc', color);
    Object.assign(badge.style, { left: `${cx}px`, top: `${cy}px` });

    this.tb.shadow.appendChild(line);
    this.tb.shadow.appendChild(cap1);
    this.tb.shadow.appendChild(cap2);
    this.tb.shadow.appendChild(badge);
    this._spacingEls.push(line, cap1, cap2, badge);
  }

  _clearSpacingOverlays() {
    this._spacingEls.forEach(el => el.remove());
    this._spacingEls = [];
  }
}
