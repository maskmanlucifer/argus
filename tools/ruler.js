import { isArgus } from './utils.js';

const LINE_COLOR  = '#F26432'; // orange dotted — visible against most page backgrounds
const SNAP_COLOR  = '#0ABE51'; // green — line lands exactly on a matching element edge
const DEFAULT_GAP  = 120;
const VIS_OFFSET   = 4; // line-vis sits this many px inside its element (see toolbar.css) — clamp against it so a line can still reach the true viewport edge

// Edge-highlight palette — cycled per matched element so overlapping/adjacent
// edges along the same ruler line stay visually distinguishable.
const EDGE_PALETTE = ['#F26432', '#2170F4', '#0ABE51', '#FFC53D', '#A855F7', '#F43F5E', '#14B8A6', '#EAB308'];
const EDGE_ROW_GAP  = 4;  // px between stacked rows when two matches' ranges overlap
const EDGE_MAX_SEGS = 48; // hard cap on matches scanned per update — keeps a pathological page from stalling drag
const EDGE_MAX_ROWS = 8;
const EDGE_PROXIMITY = 80; // px along the line — only matches within this of the cursor are shown

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
    this.poolA          = null; // pools of edge-highlight divs — one entry per matched element edge
    this.poolB          = null;
    this._dragCleanup   = null;
  }

  activate() {
    this._active = true;
    if (!this.lineA) this._createPair();
    this._showPanel();
    if (!this.poolA) this.poolA = [];
    if (!this.poolB) this.poolB = [];
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
    this.poolA?.forEach(el => el.remove());
    this.poolB?.forEach(el => el.remove());
    this.lineA = this.lineB = this.gapEl = this.gapBadge = this.gapZone = null;
    this.poolA = this.poolB = null;
  }

  destroy() { this.deactivate(); }

  // ── Edge highlight — highlights every element edge (top/bottom for a
  // horizontal ruler, left/right for a vertical one) that the line is
  // currently crossing, each in its own color, so it's obvious exactly which
  // elements align to that pixel. Only shown while a line (or the pair) is
  // actually being dragged — otherwise it'd just be noise while passively
  // hovering the page. ──
  _makeEdgeHighlight() {
    const el = document.createElement('div');
    el.className = 'ruler-edge-highlight';
    this.tb.shadow.appendChild(el);
    return el;
  }

  _hideEdgeHighlights() {
    for (const el of this.poolA) el.style.display = 'none';
    for (const el of this.poolB) el.style.display = 'none';
    this.poolA._lastCoord = this.poolB._lastCoord = undefined;
  }

  /**
   * Whether a rendered rect has an edge (top/bottom if horizontal, left/right
   * otherwise) sitting at `coord`, within a 1px tolerance.
   * @param {DOMRect} r
   * @param {number} coord
   * @param {boolean} horizontal
   * @returns {boolean}
   */
  _edgeMatch(r, coord, horizontal) {
    const EPS = 1;
    return horizontal
      ? Math.abs(r.top - coord) <= EPS || Math.abs(r.bottom - coord) <= EPS
      : Math.abs(r.left - coord) <= EPS || Math.abs(r.right - coord) <= EPS;
  }

  /**
   * Whether any rendered page element (excluding Argus's own UI) has an edge
   * at `coord`. Short-circuits on the first match — used for the ruler line's
   * own snapped/unsnapped color (see _updateSnap), which only needs a boolean.
   * @param {number} coord
   * @param {boolean} horizontal
   * @returns {boolean}
   */
  _hasEdgeMatch(coord, horizontal) {
    for (const el of document.body.querySelectorAll('*')) {
      if (isArgus(el, this.tb.shadow)) continue;
      if (el.getClientRects().length === 0) continue;
      if (this._edgeMatch(el.getBoundingClientRect(), coord, horizontal)) return true;
    }
    return false;
  }

  /**
   * Distance from `refCoord` to a [a, b] range along the cross axis — 0 if
   * refCoord falls inside the range.
   */
  _distanceToRange(refCoord, a, b) {
    return refCoord < a ? a - refCoord : refCoord > b ? refCoord - b : 0;
  }

  /**
   * Every element whose top/bottom (horizontal) or left/right (vertical) edge
   * sits at `coord`, deduped by cross-axis range.
   *
   * Dedup sorts matches by their cross-axis range and merges near-duplicates
   * in one pass, instead of an O(n²) ancestor/descendant scan — two elements
   * landing within RANGE_TOLERANCE of each other (e.g. a wrapper and a
   * full-bleed child, or two overlapping siblings) are treated as one visual
   * border, keeping only the narrower (more specific) one.
   *
   * When `refCoord` is given (the cursor's position along the line while
   * dragging), only matches within EDGE_PROXIMITY of it are kept — a page
   * layout commonly has dozens of unrelated elements sharing the same edge
   * scattered down its whole length, and showing all of them is just noise;
   * only the ones actually near where the cursor is are useful.
   * @param {number} coord
   * @param {boolean} horizontal
   * @param {number} [refCoord]
   * @returns {{a: number, b: number}[]}
   */
  _collectEdgeSegments(coord, horizontal, refCoord) {
    const RANGE_TOLERANCE = 2; // px — matches within this tolerance collapse into one segment
    // A full-page wrapper (layout container, <main>, etc.) spans almost the
    // entire viewport in the ruler's direction — it isn't a meaningful edge
    // to compare other elements against, and its huge span would otherwise
    // "overlap" nearly everything below it, forcing every real match onto
    // its own row/color for no reason. Excluded from matching entirely.
    // Skipped on small viewports (e.g. an embedded widget/iframe), where
    // ordinary content routinely spans 90%+ of a already-tiny cross axis.
    const crossMax = horizontal ? window.innerWidth : window.innerHeight;
    const wrapperCutoff = crossMax > 300 ? crossMax * 0.9 : Infinity;
    const raw = [];

    for (const el of document.body.querySelectorAll('*')) {
      if (isArgus(el, this.tb.shadow)) continue;
      if (el.getClientRects().length === 0) continue; // not rendered (display:none, detached, etc.)

      const r = el.getBoundingClientRect();
      if (!this._edgeMatch(r, coord, horizontal)) continue;

      const a = horizontal ? Math.round(r.left) : Math.round(r.top);
      const b = horizontal ? Math.round(r.right) : Math.round(r.bottom);
      if (b <= a) continue; // zero-width/height on the cross axis — nothing to draw
      if (b - a > wrapperCutoff) continue;
      if (refCoord != null && this._distanceToRange(refCoord, a, b) > EDGE_PROXIMITY) continue;

      raw.push({ a, b });
    }

    // Dedup by sweeping in order of `a`: near-duplicate ranges (e.g. a wrapper
    // and its full-bleed child) land next to each other once sorted, so
    // comparing each to the previous kept segment catches them without the
    // hard bucket-boundary edge case a rounded grouping key would have.
    raw.sort((x, y) => x.a - y.a);
    const segs = [];
    for (const cur of raw) {
      const last = segs[segs.length - 1];
      if (last && cur.a - last.a <= RANGE_TOLERANCE && Math.abs(cur.b - last.b) <= RANGE_TOLERANCE) {
        if (cur.b - cur.a < last.b - last.a) segs[segs.length - 1] = cur; // keep the narrower (more specific) one
      } else {
        segs.push(cur);
      }
    }

    // Prioritize whatever's closest to the cursor (or, with no reference
    // point, the most specific/narrowest elements) when there are still more
    // matches than we can usefully draw.
    if (segs.length > EDGE_MAX_SEGS) {
      if (refCoord != null) segs.sort((x, y) => this._distanceToRange(refCoord, x.a, x.b) - this._distanceToRange(refCoord, y.a, y.b));
      else                  segs.sort((x, y) => (x.b - x.a) - (y.b - y.a));
      segs.length = EDGE_MAX_SEGS;
    }
    return segs;
  }

  /**
   * Greedy interval-graph packing: segments whose cross-axis ranges overlap
   * get stacked into different rows (mutates `seg.row`) so they never
   * visually intersect; non-overlapping segments share row 0, right on the
   * ruler line. Segments beyond EDGE_MAX_ROWS are dropped.
   * @param {{a: number, b: number}[]} segs
   * @returns {{a: number, b: number, row: number}[]}
   */
  _assignRows(segs) {
    const PAD = 2;
    segs.sort((x, y) => x.a - y.a);
    const rowEnds = [];
    for (const seg of segs) {
      let row = rowEnds.findIndex(end => seg.a >= end + PAD);
      if (row === -1) { row = rowEnds.length; rowEnds.push(seg.b); }
      else            { rowEnds[row] = seg.b; }
      seg.row = row;
    }
    return segs.filter(s => s.row < EDGE_MAX_ROWS);
  }

  /**
   * Renders one colored highlight per matched edge near `refCoord` (see
   * _collectEdgeSegments) into `pool`, reusing/hiding pooled elements rather
   * than recreating them. No-ops if nothing relevant has changed since the
   * last call (refCoord is rounded for this check so sub-pixel mouse jitter
   * doesn't force a rescan on every event).
   * @param {Element[]} pool
   * @param {number} pos
   * @param {boolean} horizontal
   * @param {number} refCoord - cursor's position along the line
   */
  _updateEdgeHighlights(pool, pos, horizontal, refCoord) {
    const coord = pos + VIS_OFFSET; // match the actual rendered pixel, not the stored offset
    const refKey = Math.round(refCoord / 4);
    if (pool._lastCoord === coord && pool._lastHorizontal === horizontal && pool._lastRefKey === refKey) return;
    pool._lastCoord = coord;
    pool._lastHorizontal = horizontal;
    pool._lastRefKey = refKey;

    const segs = this._assignRows(this._collectEdgeSegments(coord, horizontal, refCoord));

    segs.forEach((seg, i) => {
      const el = pool[i] || (pool[i] = this._makeEdgeHighlight());
      // Color by row, not index: most matches don't actually overlap and all
      // land in row 0 — they should share one color. Only matches bumped to
      // a new row (a genuine conflict) need a distinguishing color.
      const color  = EDGE_PALETTE[seg.row % EDGE_PALETTE.length];
      const offset = seg.row * EDGE_ROW_GAP;
      el.style.background = color;
      el.style.boxShadow   = `0 0 4px ${color}99`;
      if (horizontal) {
        Object.assign(el.style, {
          display: 'block',
          left: `${seg.a}px`, top: `${coord - 1 + offset}px`,
          width: `${seg.b - seg.a}px`, height: '2px',
        });
      } else {
        Object.assign(el.style, {
          display: 'block',
          left: `${coord - 1 + offset}px`, top: `${seg.a}px`,
          width: '2px', height: `${seg.b - seg.a}px`,
        });
      }
    });

    for (let i = segs.length; i < pool.length; i++) pool[i].style.display = 'none';
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
  // The valid range for a line's stored `pos` in the current orientation —
  // bounded so the *visible* line (offset VIS_OFFSET inside its element,
  // see toolbar.css) can still reach the true viewport edge. Single source
  // of truth for every clamp in this file (drag, typed gap, rotate).
  _posBounds() {
    const max = this.orientation === 'horizontal' ? window.innerHeight : window.innerWidth;
    return { min: -VIS_OFFSET, max: max - VIS_OFFSET };
  }

  _applyPos(line, pos) {
    const { min, max } = this._posBounds();
    const clamped = Math.max(min, Math.min(pos, max));
    line.pos = clamped;
    if (this.orientation === 'horizontal') line.el.style.top  = `${clamped}px`;
    else                                   line.el.style.left = `${clamped}px`;
  }

  // ── Drag a single line — changes the gap ──
  _attachDrag(line) {
    line.el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const horizontal = this.orientation === 'horizontal';
      const startMouse  = horizontal ? e.clientY : e.clientX;
      const startPos    = line.pos;
      const pool        = line === this.lineA ? this.poolA : this.poolB;
      const otherPool   = pool === this.poolA ? this.poolB : this.poolA;
      document.body.style.userSelect = 'none';
      for (const el of otherPool) el.style.display = 'none'; // only one line is moving — only one set of highlights needed

      const onMove = (e) => {
        const current = horizontal ? e.clientY : e.clientX;
        this._applyPos(line, startPos + (current - startMouse)); // clamps internally
        this._updateGap();
        // Reference point along the line is the cursor's position on the
        // OTHER axis (e.g. for a vertical ruler dragged horizontally, that's
        // where the cursor sits vertically along the line's length).
        this._updateEdgeHighlights(pool, line.pos, horizontal, horizontal ? e.clientX : e.clientY);
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
      const { min, max } = this._posBounds();
      document.body.style.userSelect = 'none';

      const onMove = (e) => {
        const current = horizontal ? e.clientY : e.clientX;
        const delta = current - startMouse;
        // Bound the shared delta (not each line's final position independently) so
        // the pair keeps a constant gap while translating, only stopping at an edge.
        const minDelta = min - Math.min(startA, startB);
        const maxDelta = max - Math.max(startA, startB);
        const clamped = Math.max(minDelta, Math.min(delta, maxDelta));
        this._applyPos(this.lineA, startA + clamped);
        this._applyPos(this.lineB, startB + clamped);
        this._updateGap();
        // Both lines are moving together — highlight each one's own matching
        // edges near the cursor's position along the line.
        const refCoord = horizontal ? e.clientX : e.clientY;
        this._updateEdgeHighlights(this.poolA, this.lineA.pos, horizontal, refCoord);
        this._updateEdgeHighlights(this.poolB, this.lineB.pos, horizontal, refCoord);
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

  /**
   * Colors the line green (instead of the default orange) when it lands
   * exactly on a matching element edge, so an exact measurement is obvious
   * without having to drag and watch for the multi-color highlight.
   *
   * _updateGap (its only caller) runs on every mousemove during a drag, but
   * during a single-line drag the *other* line's coordinate hasn't moved —
   * skip the full-DOM rescan for it and keep its last snapped state.
   * @param {{pos: number, el: Element}} line
   */
  _updateSnap(line) {
    const horizontal = this.orientation === 'horizontal';
    const coord = line.pos + VIS_OFFSET;
    if (line._snapCoord === coord && line._snapHorizontal === horizontal) return;
    line._snapCoord = coord;
    line._snapHorizontal = horizontal;

    const snapped = this._hasEdgeMatch(coord, horizontal);
    line.el.classList.toggle('snapped', snapped);
    line.el.style.setProperty('--rc', snapped ? SNAP_COLOR : LINE_COLOR);
  }

  _updateGap() {
    this._updateSnap(this.lineA);
    this._updateSnap(this.lineB);

    const gap    = Math.abs(this.lineB.pos - this.lineA.pos);
    const minPos = Math.min(this.lineA.pos, this.lineB.pos);
    this.gapBadge.textContent = `${Math.round(gap)}px`;
    if (this.gapInput && document.activeElement !== this.gapInput) {
      this.gapInput.value = Math.round(gap);
    }

    // The visible ruler line (line-vis) is offset VIS_OFFSET inside its element
    // (top/left, see toolbar.css), so align the connector to start at the
    // actual rendered pixel, not the stored pos value.
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
        top:    `${minPos + VIS_OFFSET}px`,
        height: `${gap}px`,
        width:  '24px',
      });

      Object.assign(this.gapZone.style, {
        left: '0', right: '', width: '100vw',
        top: `${minPos + VIS_OFFSET}px`, height: `${gap}px`, bottom: '',
      });
    } else {
      let cy;
      if      (p === 'top')    cy = (rail.bottom + window.innerHeight) / 2 - 80;
      else if (p === 'bottom') cy = rail.top / 2 + 80;
      else                     cy = window.innerHeight / 2 - 80;

      el.className = 'ruler-gap-connector horizontal active';
      Object.assign(el.style, {
        top:    `${cy - 12}px`,
        left:   `${minPos + VIS_OFFSET}px`,
        width:  `${gap}px`,
        height: '24px',
      });

      Object.assign(this.gapZone.style, {
        top: '0', bottom: '', height: '100vh',
        left: `${minPos + VIS_OFFSET}px`, width: `${gap}px`, right: '',
      });
    }
  }

  // ── Editable gap, in the panel — type an exact value, second line snaps to it ──
  _setGap(val) {
    val = Math.max(0, Math.round(Number(val)) || 0);
    const dir = Math.sign(this.lineB.pos - this.lineA.pos) || 1;
    this._applyPos(this.lineB, this.lineA.pos + dir * val); // clamps internally
    this._updateGap();
  }

  // ── Rotate both lines together (90° mapped through viewport center) ──
  _rotate() {
    const oldMax = this.orientation === 'horizontal' ? window.innerHeight : window.innerWidth;
    const newMax = this.orientation === 'horizontal' ? window.innerWidth  : window.innerHeight;
    const mapPos = (pos) => Math.round(newMax / 2 + (pos - oldMax / 2)); // _applyPos clamps once orientation flips below

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
