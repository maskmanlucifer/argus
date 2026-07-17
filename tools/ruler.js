import { isArgus } from './utils.js';

const LINE_COLOR  = '#F26432'; // orange dotted — visible against most page backgrounds
const DEFAULT_GAP  = 120;

export class RulerTool {
  constructor(toolbar) {
    this.tb            = toolbar;
    this.panel         = null;
    this.orientation   = 'horizontal';
    this.lineA         = null;
    this.lineB         = null;
    this.gapEl         = null;
    this.gapBadge      = null;
    this.gapZone       = null;
    this.gapInput       = null;
    this.edgeHighlightA = null;
    this.edgeHighlightB = null;
    this._dragCleanup   = null;
  }

  activate() {
    this._active = true;
    if (!this.lineA) this._createPair();
    this._showPanel();
    if (!this.edgeHighlightA) this.edgeHighlightA = this._makeEdgeHighlight();
    if (!this.edgeHighlightB) this.edgeHighlightB = this._makeEdgeHighlight();
  }

  deactivate() {
    this._active = false;
    this._dragCleanup?.(); // an in-progress drag would otherwise keep firing on a nulled-out pair
    this._dragCleanup = null;
    this.panel?.remove();
    this.panel = null;
    this.gapInput = null;
    this.lineA?.el.remove();
    this.lineB?.el.remove();
    this.gapEl?.remove();
    this.gapZone?.remove();
    this.edgeHighlightA?.remove();
    this.edgeHighlightB?.remove();
    this.lineA = this.lineB = this.gapEl = this.gapBadge = this.gapZone = null;
    this.edgeHighlightA = this.edgeHighlightB = null;
  }

  destroy() { this.deactivate(); }

  // ── Edge highlight — snaps to the nearest matching edge (top/bottom for a
  // horizontal ruler, left/right for a vertical one) of whatever's under a
  // line, so it's obvious exactly which pixel you're measuring against. Only
  // shown while a line (or the pair) is actually being dragged — otherwise
  // it'd just be noise while passively hovering the page. ──
  _makeEdgeHighlight() {
    const el = document.createElement('div');
    el.className = 'ruler-edge-highlight';
    this.tb.shadow.appendChild(el);
    return el;
  }

  _hideEdgeHighlights() {
    this.edgeHighlightA.style.display = 'none';
    this.edgeHighlightB.style.display = 'none';
  }

  _updateEdgeHighlight(el, x, y) {
    // Only within a tight snap distance — otherwise "nearest edge" can pick a
    // far border (e.g. a large ancestor's) well before the line has actually
    // reached it, which reads as the highlight jumping to the wrong element
    // early. The line's exact position may itself sit in the blank gap just
    // outside an element (nothing painted there but html/body), so probe a
    // little further out on either side too, to find a border that's close
    // by even though the line hasn't reached it yet.
    const SNAP_DISTANCE = 24;
    const horizontal = this.orientation === 'horizontal';
    let best = null; // { left, edge, width } in horizontal; { top, edge, height } in vertical

    for (const offset of [0, SNAP_DISTANCE, -SNAP_DISTANCE]) {
      const px = horizontal ? x : x + offset;
      const py = horizontal ? y + offset : y;
      const target = document.elementsFromPoint(px, py)
        .find(t => t !== document.documentElement && t !== document.body && !isArgus(t, this.tb.shadow));
      if (!target) continue;

      const r = target.getBoundingClientRect();
      if (horizontal) {
        const distTop    = Math.abs(y - r.top);
        const distBottom = Math.abs(y - r.bottom);
        const dist = Math.min(distTop, distBottom);
        if (dist <= SNAP_DISTANCE && (!best || dist < best.dist)) {
          best = { dist, left: r.left, width: r.width, edge: distTop <= distBottom ? r.top : r.bottom };
        }
      } else {
        const distLeft  = Math.abs(x - r.left);
        const distRight = Math.abs(x - r.right);
        const dist = Math.min(distLeft, distRight);
        if (dist <= SNAP_DISTANCE && (!best || dist < best.dist)) {
          best = { dist, top: r.top, height: r.height, edge: distLeft <= distRight ? r.left : r.right };
        }
      }
    }

    if (!best) { el.style.display = 'none'; return; }

    if (horizontal) {
      Object.assign(el.style, {
        display: 'block',
        left: `${best.left}px`, top: `${best.edge - 1}px`,
        width: `${best.width}px`, height: '2px',
      });
    } else {
      Object.assign(el.style, {
        display: 'block',
        left: `${best.edge - 1}px`, top: `${best.top}px`,
        width: '2px', height: `${best.height}px`,
      });
    }
  }

  // ── Pair creation ──
  _createPair() {
    this.orientation = 'horizontal'; // always start a fresh pair the same way _reset() does
    const mid  = Math.round(window.innerHeight / 2);
    const half = DEFAULT_GAP / 2;
    this.lineA = this._makeLine(mid - half);
    this.lineB = this._makeLine(mid + half);
    this._createConnector();
    this._createGapZone();
    this._updateGap();
  }

  _makeLine(pos) {
    const el = document.createElement('div');
    el.className = `argus-ruler-line ${this.orientation}`;
    el.style.setProperty('--rc', LINE_COLOR);

    const vis = document.createElement('div');
    vis.className = 'line-vis';
    el.appendChild(vis);

    const body = document.createElement('div');
    body.className = 'line-body';
    el.appendChild(body);

    this.tb.shadow.appendChild(el);

    const line = { pos, el };
    this._applyPos(line, pos);
    this._attachDrag(line);
    return line;
  }

  // ── Position ──
  _applyPos(line, pos) {
    line.pos = pos;
    if (this.orientation === 'horizontal') line.el.style.top  = `${pos}px`;
    else                                   line.el.style.left = `${pos}px`;
  }

  // ── Drag a single line — changes the gap ──
  _attachDrag(line) {
    line.el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const horizontal = this.orientation === 'horizontal';
      const startMouse  = horizontal ? e.clientY : e.clientX;
      const startPos    = line.pos;
      const max         = horizontal ? window.innerHeight : window.innerWidth;
      document.body.style.userSelect = 'none';
      this.edgeHighlightB.style.display = 'none'; // only one line is moving — only one highlight needed

      const onMove = (e) => {
        const current = horizontal ? e.clientY : e.clientX;
        const next = Math.max(0, Math.min(startPos + (current - startMouse), max));
        this._applyPos(line, next);
        this._updateGap();
        if (horizontal) this._updateEdgeHighlight(this.edgeHighlightA, e.clientX, next);
        else            this._updateEdgeHighlight(this.edgeHighlightA, next, e.clientY);
      };
      const onUp = () => {
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        this._hideEdgeHighlights();
        this._dragCleanup = null;
      };
      this._dragCleanup = onUp;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // ── Gap connector — purely visual (dotted segs + px badge), sits on top of the gap zone ──
  _createConnector() {
    const el = document.createElement('div');
    el.className = 'ruler-gap-connector active';

    const s1    = document.createElement('div');
    s1.className = 'gap-seg';
    const badge = document.createElement('div');
    badge.className = 'gap-badge';
    const s2    = document.createElement('div');
    s2.className = 'gap-seg';

    el.appendChild(s1);
    el.appendChild(badge);
    el.appendChild(s2);

    this.tb.shadow.appendChild(el);
    this.gapEl    = el;
    this.gapBadge = badge;
  }

  // Full-width/height band between the two lines — hover it anywhere to see the
  // move affordance, drag anywhere in it to move both lines together, gap unchanged.
  _createGapZone() {
    const el = document.createElement('div');
    el.className = 'ruler-gap-zone';
    this.tb.shadow.appendChild(el);
    this.gapZone = el;

    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const horizontal = this.orientation === 'horizontal';
      const startMouse  = horizontal ? e.clientY : e.clientX;
      const startA      = this.lineA.pos;
      const startB      = this.lineB.pos;
      const max         = horizontal ? window.innerHeight : window.innerWidth;
      document.body.style.userSelect = 'none';

      const onMove = (e) => {
        const current = horizontal ? e.clientY : e.clientX;
        const delta = current - startMouse;
        const minDelta = -Math.min(startA, startB);
        const maxDelta = max - Math.max(startA, startB);
        const clamped = Math.max(minDelta, Math.min(delta, maxDelta));
        this._applyPos(this.lineA, startA + clamped);
        this._applyPos(this.lineB, startB + clamped);
        this._updateGap();
        // Both lines are moving together — highlight each one's own nearest edge.
        if (horizontal) {
          this._updateEdgeHighlight(this.edgeHighlightA, e.clientX, this.lineA.pos);
          this._updateEdgeHighlight(this.edgeHighlightB, e.clientX, this.lineB.pos);
        } else {
          this._updateEdgeHighlight(this.edgeHighlightA, this.lineA.pos, e.clientY);
          this._updateEdgeHighlight(this.edgeHighlightB, this.lineB.pos, e.clientY);
        }
      };
      const onUp = () => {
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        this._hideEdgeHighlights();
        this._dragCleanup = null;
      };
      this._dragCleanup = onUp;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  _updateGap() {
    const gap    = Math.abs(this.lineB.pos - this.lineA.pos);
    const minPos = Math.min(this.lineA.pos, this.lineB.pos);
    this.gapBadge.textContent = `${Math.round(gap)}px`;
    if (this.gapInput && document.activeElement !== this.gapInput) {
      this.gapInput.value = Math.round(gap);
    }

    // The visible ruler line (line-vis) is offset 4px inside its element
    // (top:4px for horizontal, left:4px for vertical), so align the connector
    // to start at the actual rendered pixel, not the stored pos value.
    const VIS  = 4;
    const el   = this.gapEl;
    const p    = this.tb.placement;
    const rail = this.tb.rail.getBoundingClientRect();

    if (this.orientation === 'horizontal') {
      // Slightly off-center — near the chip row but not overlapping it (chips sit at window.innerWidth/2)
      let cx;
      if      (p === 'left')  cx = (rail.right + window.innerWidth) / 2 - 100;
      else if (p === 'right') cx = rail.left / 2 + 100;
      else                    cx = window.innerWidth / 2 - 100;

      el.className = 'ruler-gap-connector vertical active';
      Object.assign(el.style, {
        left:   `${cx - 12}px`,
        top:    `${minPos + VIS}px`,
        height: `${gap}px`,
        width:  '24px',
      });

      Object.assign(this.gapZone.style, {
        left: '0', right: '', width: '100vw',
        top: `${minPos + VIS}px`, height: `${gap}px`, bottom: '',
      });
    } else {
      let cy;
      if      (p === 'top')    cy = (rail.bottom + window.innerHeight) / 2 - 80;
      else if (p === 'bottom') cy = rail.top / 2 + 80;
      else                     cy = window.innerHeight / 2 - 80;

      el.className = 'ruler-gap-connector horizontal active';
      Object.assign(el.style, {
        top:    `${cy - 12}px`,
        left:   `${minPos + VIS}px`,
        width:  `${gap}px`,
        height: '24px',
      });

      Object.assign(this.gapZone.style, {
        top: '0', bottom: '', height: '100vh',
        left: `${minPos + VIS}px`, width: `${gap}px`, right: '',
      });
    }
  }

  // ── Editable gap, in the panel — type an exact value, second line snaps to it ──
  _setGap(val) {
    val = Math.max(0, Math.round(Number(val)) || 0);
    const horizontal = this.orientation === 'horizontal';
    const max = horizontal ? window.innerHeight : window.innerWidth;
    const dir = Math.sign(this.lineB.pos - this.lineA.pos) || 1;
    const newB = Math.max(0, Math.min(this.lineA.pos + dir * val, max));
    this._applyPos(this.lineB, newB);
    this._updateGap();
  }

  // ── Rotate both lines together (90° mapped through viewport center) ──
  _rotate() {
    const oldMax = this.orientation === 'horizontal' ? window.innerHeight : window.innerWidth;
    const newMax = this.orientation === 'horizontal' ? window.innerWidth  : window.innerHeight;
    const mapPos = (pos) => Math.max(0, Math.min(Math.round(newMax / 2 + (pos - oldMax / 2)), newMax));

    const newA = mapPos(this.lineA.pos);
    const newB = mapPos(this.lineB.pos);
    this.orientation = this.orientation === 'horizontal' ? 'vertical' : 'horizontal';

    [this.lineA, this.lineB].forEach((line) => {
      line.el.className = `argus-ruler-line ${this.orientation}`;
      line.el.style.top  = '';
      line.el.style.left = '';
    });
    this._applyPos(this.lineA, newA);
    this._applyPos(this.lineB, newB);
    this._updateGap();
  }

  // ── Reset to the default pair ──
  _reset() {
    this.orientation = 'horizontal';
    const mid  = Math.round(window.innerHeight / 2);
    const half = DEFAULT_GAP / 2;
    [this.lineA, this.lineB].forEach((line) => {
      line.el.className = 'argus-ruler-line horizontal';
      line.el.style.left = '';
    });
    this._applyPos(this.lineA, mid - half);
    this._applyPos(this.lineB, mid + half);
    this._updateGap();
  }

  // ── Panel ──
  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;

    p.innerHTML = `
      <div class="panel-label">Rulers</div>
      <div class="ruler-gap-field">
        <span class="ruler-gap-field-label">Gap</span>
        <input type="number" class="ruler-gap-input" id="argus-ruler-gap" min="0" step="1">
        <span class="ruler-gap-field-unit">px</span>
      </div>
      <div class="ruler-btn-row">
        <button class="ruler-action-btn" id="argus-ruler-rotate">
          <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10a6 6 0 1 1 2 4.5"/><path d="M4 15v-3h3"/></svg>
          Rotate
        </button>
        <button class="ruler-action-btn" id="argus-ruler-reset">Reset</button>
      </div>
    `;

    const gapInput = p.querySelector('#argus-ruler-gap');
    gapInput.value = Math.round(Math.abs(this.lineB.pos - this.lineA.pos));
    gapInput.addEventListener('input', () => {
      if (gapInput.value === '') return; // mid-edit (e.g. cleared to retype) — don't snap to 0
      this._setGap(gapInput.value);
    });
    gapInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') gapInput.blur(); });
    this.gapInput = gapInput;

    p.querySelector('#argus-ruler-rotate').addEventListener('click', () => this._rotate());
    p.querySelector('#argus-ruler-reset').addEventListener('click', () => this._reset());

    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel();
  }

  _positionPanel() {
    if (!this.panel) return;
    const rail = this.tb.rail.getBoundingClientRect();
    const placement = this.tb.placement;
    const gap = 6;
    const M   = 8; // min margin from viewport edges

    // Place at 0,0 first so getBoundingClientRect gives true intrinsic size
    Object.assign(this.panel.style, { top: '0px', left: '0px' });
    const pw = this.panel.getBoundingClientRect().width;
    const ph = this.panel.getBoundingClientRect().height;

    let top, left;
    if (placement === 'left')        { left = rail.right + gap;      top = rail.top; }
    else if (placement === 'right')  { left = rail.left - pw - gap;  top = rail.top; }
    else if (placement === 'top')    { top  = rail.bottom + gap;     left = rail.left; }
    else                             { top  = rail.top - ph - gap;   left = rail.left; }

    // Clamp so the panel never bleeds outside the viewport
    left = Math.max(M, Math.min(left, window.innerWidth  - pw - M));
    top  = Math.max(M, Math.min(top,  window.innerHeight - ph - M));

    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  // ── Helpers ──
  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); if (this.lineA) this._updateGap(); }
}
