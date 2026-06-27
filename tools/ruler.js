const LINE_COLORS = [
  '#2170F4', // blue
  '#E91E8C', // pink
  '#16A085', // teal
  '#E67E22', // amber
  '#9B59B6', // purple
];
const PINNED_COLOR = '#111111';

export class RulerTool {
  constructor(toolbar) {
    this.tb              = toolbar;
    this.panel           = null;
    this.lines           = [];
    this.selected        = null;
    this._nextId         = 1;
    this._colorIdx       = 0;
    this.gapConnector    = null;
    this.gapBadge        = null;
    this.guideEl         = null;
    this._guideDismissed = undefined; // undefined = not yet loaded from storage
    this._hasDragged     = false;     // advances guide past the drag step
  }

  activate() {
    this._active = true;
    this._createGapConnector();
    if (this._guideDismissed !== undefined) {
      this._showPanel();
    } else {
      chrome.storage.local.get('argus_ruler_guide_dismissed', (data) => {
        if (!this._active) return; // deactivated before storage resolved
        this._guideDismissed = !!data.argus_ruler_guide_dismissed;
        this._showPanel();
      });
    }
  }

  deactivate() {
    this._active = false;
    this.panel?.remove();
    this.panel = null;
    // Lines stay visible; destroyed on close
  }

  destroy() {
    this.panel?.remove();
    this.panel = null;
    this._clearAll();
    this.gapConnector?.remove();
    this.gapConnector = null;
    this.gapBadge = null;
  }

  // ── Gap connector (shared singleton) ──
  _createGapConnector() {
    if (this.gapConnector) return;
    const el = document.createElement('div');
    el.className = 'ruler-gap-connector';

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
    this.gapConnector = el;
    this.gapBadge     = badge;
  }

  _showGapConnector(selLine, hovLine) {
    if (!this.gapConnector) return;
    const gap    = Math.abs(selLine.pos - hovLine.pos);
    const minPos = Math.min(selLine.pos, hovLine.pos);

    this.gapBadge.textContent = `${Math.round(gap)}px`;

    // The visible ruler line (line-vis) is offset 4px inside its element
    // (top:4px for horizontal, left:4px for vertical), so align the connector
    // to start at the actual rendered pixel, not the stored pos value.
    const VIS  = 4;
    const el   = this.gapConnector;
    const p    = this.tb.placement;
    const rail = this.tb.rail.getBoundingClientRect();

    if (hovLine.orientation === 'horizontal') {
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
    } else {
      // Same logic for vertical lines / horizontal connector
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
    }
  }

  _hideGapConnector() {
    if (this.gapConnector) this.gapConnector.classList.remove('active');
  }

  // ── Panel ──
  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;

    p.innerHTML = `
      <div class="panel-label">Rulers</div>
      <div class="ruler-add-row">
        <button class="ruler-add-btn" id="argus-add-h">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="10" x2="18" y2="10"/></svg>
          Horizontal
        </button>
        <button class="ruler-add-btn" id="argus-add-v">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="10" y1="2" x2="10" y2="18"/></svg>
          Vertical
        </button>
      </div>
      <button class="ruler-clear-btn" id="argus-clear-rulers">Clear all</button>
    `;

    p.querySelector('#argus-add-h').addEventListener('click', () => this._addLine('horizontal'));
    p.querySelector('#argus-add-v').addEventListener('click', () => this._addLine('vertical'));
    p.querySelector('#argus-clear-rulers').addEventListener('click', () => this._clearAll());

    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel();
    if (!this._guideDismissed) this._injectGuide();
    this._updateGuide();
  }

  // Creates the guide section and appends it to the panel.
  // Safe to call multiple times — bails if guide already exists or panel is gone.
  _injectGuide() {
    if (!this.panel || this.guideEl) return;
    const guide = document.createElement('div');
    guide.className = 'ruler-guide';
    guide.innerHTML = `<div class="ruler-guide-text"></div><button class="ruler-guide-close" title="Dismiss">✕</button>`;
    guide.querySelector('.ruler-guide-close').addEventListener('click', () => this._dismissGuide());
    this.panel.appendChild(guide);
    this.guideEl = guide.querySelector('.ruler-guide-text');
  }

  _updateGuide() {
    if (!this.guideEl) return;

    // Determine current incomplete step (0–4). Each step stays active until the
    // user actually completes it — the guide never skips forward prematurely.
    let step;
    if (this.lines.length === 0)      step = 0; // haven't added a line yet
    else if (!this._hasDragged)       step = 1; // added but not positioned
    else if (this.lines.length < 2)   step = 2; // need a second line to measure
    else if (this.selected == null)   step = 3; // have 2 lines but none pinned
    else                              step = 4; // pinned — hover another for gap

    const PIN_ICON = `<span class="guide-em"><svg class="guide-icon" viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="15"/><line x1="1" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="15" y2="8"/></svg></span>`;

    // Smart second-line suggestion: tell the user which orientation they're missing
    const hasH = this.lines.some(l => l.orientation === 'horizontal');
    const hasV = this.lines.some(l => l.orientation === 'vertical');
    let secondLineLabel;
    if (hasH && !hasV)      secondLineLabel = 'Add another <b>Horizontal</b> line to measure the gap';
    else if (hasV && !hasH) secondLineLabel = 'Add another <b>Vertical</b> line to measure the gap';
    else                    secondLineLabel = 'Add a <b>second</b> line (H or V)';

    const steps = [
      { label: 'Click <b>H</b> or <b>V</b> to add a guide line' },
      { label: 'Drag the line to position it' },
      { label: secondLineLabel },
      { label: `Hover a line → click ${PIN_ICON} to pin it` },
      { label: 'Hover the other line to see the gap' },
    ];

    this.guideEl.innerHTML = steps.map((s, i) => {
      const cls = i < step ? 'guide-step past' : i === step ? 'guide-step active' : 'guide-step next';
      return `<div class="${cls}"><span class="step-dot">${i < step ? '✓' : i + 1}</span><span class="step-text">${s.label}</span></div>`;
    }).join('');
  }

  _dismissGuide() {
    this._guideDismissed = true;
    chrome.storage.local.set({ argus_ruler_guide_dismissed: true });
    const guideWrapper = this.panel?.querySelector('.ruler-guide');
    if (guideWrapper) guideWrapper.remove();
    this.guideEl = null;
  }

  _positionPanel() {
    if (!this.panel) return;
    const rail = this.tb.rail.getBoundingClientRect();
    const placement = this.tb.placement;
    const gap = 6;
    let top, left;
    if (placement === 'left')        { left = rail.right + gap; top = rail.top; }
    else if (placement === 'right')  { left = rail.left - 220 - gap; top = rail.top; }
    else if (placement === 'top')    { top = rail.bottom + gap; left = Math.max(8, rail.left); }
    else                             { top = rail.top - 170 - gap; left = Math.max(8, rail.left); }
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  // ── Add line ──
  _addLine(orientation) {
    const id  = this._nextId++;
    const pos = orientation === 'horizontal'
      ? Math.round(window.innerHeight / 2)
      : Math.round(window.innerWidth  / 2);

    const color = LINE_COLORS[this._colorIdx % LINE_COLORS.length];
    this._colorIdx++;

    const el = document.createElement('div');
    el.className = `argus-ruler-line ${orientation}`;
    el.dataset.lineId = id;
    el.style.setProperty('--rc', color);

    const vis = document.createElement('div');
    vis.className = 'line-vis';
    el.appendChild(vis);

    const body = document.createElement('div');
    body.className = 'line-body';
    el.appendChild(body);

    // Chip: default hint, tools revealed on chip-hover
    const chip = document.createElement('div');
    chip.className = 'ruler-chip';

    const hint = document.createElement('span');
    hint.className = 'chip-hint';
    hint.textContent = '';

    const tools = document.createElement('div');
    tools.className = 'chip-tools';

    const rotBtn = document.createElement('button');
    rotBtn.className = 'ruler-chip-btn rotate-btn';
    rotBtn.textContent = '↻';
    rotBtn.addEventListener('click', (e) => { e.stopPropagation(); this._rotateLine(id); });

    const minusBtn = document.createElement('button');
    minusBtn.className = 'ruler-chip-btn nudge-btn';
    minusBtn.textContent = '−';
    minusBtn.addEventListener('click', (e) => { e.stopPropagation(); this._nudge(id, -1); });

    const plusBtn = document.createElement('button');
    plusBtn.className = 'ruler-chip-btn nudge-btn';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', (e) => { e.stopPropagation(); this._nudge(id, +1); });

    const selBtn = document.createElement('button');
    selBtn.className = 'ruler-chip-btn select-btn';
    selBtn.innerHTML = `<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="4"/><line x1="8" y1="12" x2="8" y2="15"/><line x1="1" y1="8" x2="4" y2="8"/><line x1="12" y1="8" x2="15" y2="8"/></svg>`;
    selBtn.addEventListener('click', (e) => { e.stopPropagation(); this._selectLine(id); });

    const delBtn = document.createElement('button');
    delBtn.className = 'ruler-chip-btn delete-btn';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); this._deleteLine(id); });

    tools.appendChild(rotBtn);
    tools.appendChild(minusBtn);
    tools.appendChild(plusBtn);
    tools.appendChild(selBtn);
    tools.appendChild(delBtn);
    chip.appendChild(hint);
    chip.appendChild(tools);
    el.appendChild(chip);

    this.tb.shadow.appendChild(el);

    const line = { id, orientation, pos, el, chip, hint, color };
    this.lines.push(line);

    this._applyPos(line, pos);
    this._attachDrag(line);
    this._attachHoverGap(line);
    this._updateStackState();
    this._updateGuide();
  }

  // ── Position ──
  _applyPos(line, pos) {
    line.pos = pos;
    if (line.orientation === 'horizontal') {
      line.el.style.top = `${pos}px`;
    } else {
      line.el.style.left = `${pos}px`;
    }
    // chip position is managed by _updateStackState after every move
  }

  _moveLine(line, pos) {
    const max = line.orientation === 'horizontal' ? window.innerHeight : window.innerWidth;
    const clamped = Math.max(0, Math.min(pos, max));
    this._applyPos(line, clamped);
    this._updateStackState();
  }

  // ── Stack detection — spread chips when lines overlap ──
  _updateStackState() {
    const THRESHOLD = 3;
    const SPREAD    = 90; // px between chips when stacked

    // Group lines by orientation + bucketed position
    const groups = {};
    for (const line of this.lines) {
      const key = `${line.orientation}:${Math.round(line.pos / THRESHOLD)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(line);
    }

    for (const group of Object.values(groups)) {
      const count = group.length;
      group.forEach((line, idx) => {
        // Count badge
        this._setStackBadge(line, count);

        // Spread chips along their axis so each is individually reachable
        const offset = count > 1
          ? (idx - (count - 1) / 2) * SPREAD
          : 0;

        if (line.orientation === 'horizontal') {
          line.chip.style.left      = `${Math.round(window.innerWidth  / 2) + offset}px`;
          line.chip.style.top       = '4px';
          line.chip.style.transform = 'translate(-50%, -50%)';
        } else {
          line.chip.style.top       = `${Math.round(window.innerHeight / 2) + offset}px`;
          line.chip.style.left      = '4px';
          line.chip.style.transform = 'translate(-50%, -50%)';
        }
      });
    }
  }

  _setStackBadge(line, count) {
    let badge = line.chip.querySelector('.stack-badge');
    if (count <= 1) { badge?.remove(); return; }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'stack-badge';
      line.chip.appendChild(badge);
    }
    badge.textContent = `×${count}`;
  }

  // ── Rotate (90° mapped through viewport center) ──
  _rotateLine(id) {
    const line = this._getLine(id);
    if (!line) return;

    // Map position symmetrically through the viewport center so the line
    // appears at the same distance-from-center on the new axis.
    let newPos;
    if (line.orientation === 'horizontal') {
      const delta = line.pos - window.innerHeight / 2;
      newPos = Math.round(window.innerWidth / 2 + delta);
      newPos = Math.max(0, Math.min(newPos, window.innerWidth));
    } else {
      const delta = line.pos - window.innerWidth / 2;
      newPos = Math.round(window.innerHeight / 2 + delta);
      newPos = Math.max(0, Math.min(newPos, window.innerHeight));
    }

    line.orientation = line.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    line.el.className = `argus-ruler-line ${line.orientation}`;
    line.el.style.top  = '';
    line.el.style.left = '';
    this._applyPos(line, newPos);
    if (this.selected === line.id) {
      this._applyColor(line, true);
      this._setHint(line, true);
    }
    this._hideGapConnector();
    this._updateStackState();
  }

  // ── Select ──
  _selectLine(id) {
    if (this.selected != null && this.selected !== id) {
      const prev = this._getLine(this.selected);
      if (prev) { prev.el.classList.remove('selected'); this._applyColor(prev, false); this._setHint(prev, false); }
    }
    if (this.selected === id) {
      const line = this._getLine(id);
      if (line) { line.el.classList.remove('selected'); this._applyColor(line, false); this._setHint(line, false); }
      this.selected = null;
      this._updateGuide();
      return;
    }
    this.selected = id;
    const line = this._getLine(id);
    if (line) {
      line.el.classList.add('selected');
      this._applyColor(line, true);
      this._setHint(line, true);
    }
    this._updateGuide();
  }

  _nudge(id, delta) {
    const line = this._getLine(id);
    if (line) this._moveLine(line, line.pos + delta);
  }

  _applyColor(line, pinned) {
    line.el.style.setProperty('--rc', pinned ? PINNED_COLOR : line.color);
  }

  _setHint(line, pinned) {
    if (!line.hint) return;
    if (pinned) {
      line.hint.textContent = 'hover others · gap';
      line.chip.classList.add('has-hint');
    } else {
      line.hint.textContent = '';
      line.chip.classList.remove('has-hint');
    }
  }


  // ── Gap display ──
  _attachHoverGap(line) {
    line.el.addEventListener('mouseenter', () => {
      if (this.selected == null || this.selected === line.id) return;
      const sel = this._getLine(this.selected);
      if (!sel || sel.orientation !== line.orientation) return;
      this._showGapConnector(sel, line);
    });

    line.el.addEventListener('mouseleave', () => {
      this._hideGapConnector();
    });
  }

  // ── Drag ──
  _attachDrag(line) {
    line.el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ruler-chip-btn')) return;
      e.preventDefault();

      const startPos   = line.pos;
      const startMouse = line.orientation === 'horizontal' ? e.clientY : e.clientX;
      document.body.style.userSelect = 'none';

      const onMove = (e) => {
        const current = line.orientation === 'horizontal' ? e.clientY : e.clientX;
        this._moveLine(line, startPos + (current - startMouse));
      };
      const onUp = (e) => {
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        const current = line.orientation === 'horizontal' ? e.clientY : e.clientX;
        if (Math.abs(current - startMouse) > 2) {
          this._hasDragged = true;
          this._updateGuide();
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  // ── Delete ──
  _deleteLine(id) {
    const line = this._getLine(id);
    if (!line) return;
    line.el.remove();
    this.lines = this.lines.filter(l => l.id !== id);
    if (this.selected === id) this.selected = null;
    this._hideGapConnector(); // always hide — removing any line may leave the connector stale
    if (this.lines.length === 0) this._hasDragged = false;
    this._updateStackState();
    this._updateGuide();
  }

  _clearAll() {
    this.lines.forEach(l => l.el.remove());
    this.lines = [];
    this.selected    = null;
    this._hasDragged = false;
    this._hideGapConnector();
    this._updateGuide();
  }

  // ── Helpers ──
  _getLine(id) { return this.lines.find(l => l.id === id) || null; }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); }
}
