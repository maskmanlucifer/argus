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

  // Whether some rendered element's edge sits at `coord`, for the ruler
  // line's own snapped/unsnapped color (see _updateSnap).
  _edgeMatch(r, coord, horizontal) {
    const EPS = 1;
    return horizontal
      ? Math.abs(r.top - coord) <= EPS || Math.abs(r.bottom - coord) <= EPS
      : Math.abs(r.left - coord) <= EPS || Math.abs(r.right - coord) <= EPS;
  }

  _hasEdgeMatch(coord, horizontal) {
    for (const el of document.body.querySelectorAll('*')) {
      if (isArgus(el, this.tb.shadow)) continue;
      if (el.getClientRects().length === 0) continue;
      if (this._edgeMatch(el.getBoundingClientRect(), coord, horizontal)) return true;
    }
    return false;
  }

  // Every element whose top/bottom (horizontal) or left/right (vertical) edge
  // sits at `coord`, deduped by cross-axis range and capped to keep a
  // pathological page from stalling drag.
  _collectEdgeSegments(coord, horizontal) {
    const raw = [];

    for (const el of document.body.querySelectorAll('*')) {
      if (isArgus(el, this.tb.shadow)) continue;
      if (el.getClientRects().length === 0) continue; // not rendered (display:none, detached, etc.)

      const r = el.getBoundingClientRect();
      if (!this._edgeMatch(r, coord, horizontal)) continue;

      const a = horizontal ? Math.round(r.left) : Math.round(r.top);
      const b = horizontal ? Math.round(r.right) : Math.round(r.bottom);
      if (b <= a) continue; // zero-width/height on the cross axis — nothing to draw

      raw.push({ el, a, b });
    }

    // Collapse ancestor/descendant pairs sharing (near enough) the same range —
    // a full-bleed child (e.g. an <img> filling its wrapper) renders the same
    // visual edge as its container, and should read as one border, not two.
    const RANGE_EPS = 2;
    const segs = [];
    for (const cur of raw) {
      const coveredByAncestor = raw.some(other =>
        other !== cur &&
        Math.abs(cur.a - other.a) <= RANGE_EPS && Math.abs(cur.b - other.b) <= RANGE_EPS &&
        other.el !== cur.el && other.el.contains(cur.el));
      if (!coveredByAncestor) segs.push(cur);
    }

    // Any remaining elements that land on the exact same range (e.g.
    // overlapping siblings, not ancestor/descendant) — keep just the first.
    const seen = new Set();
    const deduped = segs.filter(({ a, b }) => {
      const key = `${a}:${b}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Prioritize the most specific (narrowest) elements when there are more
    // matches than we can usefully draw.
    if (deduped.length > EDGE_MAX_SEGS) {
      deduped.sort((x, y) => (x.b - x.a) - (y.b - y.a));
      deduped.length = EDGE_MAX_SEGS;
    }
    return deduped;
  }

  // Greedy interval-graph packing: segments whose cross-axis ranges overlap
  // get stacked into different rows so they never visually intersect;
  // non-overlapping segments share row 0, right on the ruler line.
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

  _updateEdgeHighlights(pool, pos, horizontal) {
    const coord = pos + VIS_OFFSET; // match the actual rendered pixel, not the stored offset
    if (pool._lastCoord === coord && pool._lastHorizontal === horizontal) return;
    pool._lastCoord = coord;
    pool._lastHorizontal = horizontal;

    const segs = this._assignRows(this._collectEdgeSegments(coord, horizontal));

    segs.forEach((seg, i) => {
      const el = pool[i] || (pool[i] = this._makeEdgeHighlight());
      const color  = EDGE_PALETTE[i % EDGE_PALETTE.length];
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
      const pool        = line === this.lineA ? this.poolA : this.poolB;
      const otherPool   = pool === this.poolA ? this.poolB : this.poolA;
      document.body.style.userSelect = 'none';
      for (const el of otherPool) el.style.display = 'none'; // only one line is moving — only one set of highlights needed

      const onMove = (e) => {
        const current = horizontal ? e.clientY : e.clientX;
        const next = Math.max(-VIS_OFFSET, Math.min(startPos + (current - startMouse), max - VIS_OFFSET));
        this._applyPos(line, next);
        this._updateGap();
        this._updateEdgeHighlights(pool, next, horizontal);
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
        const minDelta = -VIS_OFFSET - Math.min(startA, startB);
        const maxDelta = max - VIS_OFFSET - Math.max(startA, startB);
        const clamped = Math.max(minDelta, Math.min(delta, maxDelta));
        this._applyPos(this.lineA, startA + clamped);
        this._applyPos(this.lineB, startB + clamped);
        this._updateGap();
        // Both lines are moving together — highlight each one's own matching edges.
        this._updateEdgeHighlights(this.poolA, this.lineA.pos, horizontal);
        this._updateEdgeHighlights(this.poolB, this.lineB.pos, horizontal);
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

  // Colors the line green (instead of the default orange) when it lands
  // exactly on a matching element edge, so an exact measurement is obvious
  // without having to drag and watch for the multi-color highlight.
  _updateSnap(line) {
    const horizontal = this.orientation === 'horizontal';
    const snapped = this._hasEdgeMatch(line.pos + VIS_OFFSET, horizontal);
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
    const newB = Math.max(-VIS_OFFSET, Math.min(this.lineA.pos + dir * val, max - VIS_OFFSET));
    this._applyPos(this.lineB, newB);
    this._updateGap();
  }

  // ── Rotate both lines together (90° mapped through viewport center) ──
  _rotate() {
    const oldMax = this.orientation === 'horizontal' ? window.innerHeight : window.innerWidth;
    const newMax = this.orientation === 'horizontal' ? window.innerWidth  : window.innerHeight;
    const mapPos = (pos) => Math.max(-VIS_OFFSET, Math.min(Math.round(newMax / 2 + (pos - oldMax / 2)), newMax - VIS_OFFSET));

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
