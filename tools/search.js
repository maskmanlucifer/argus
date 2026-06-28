import { isArgus } from './utils.js';

export class SearchTool {
  constructor(toolbar) {
    this.tb       = toolbar;
    this.panel    = null;
    this.matches  = [];
    this.current  = -1;
    this.hls      = [];
    this._active  = false;
    this._onKey   = this._onKeyDown.bind(this);
  }

  activate() {
    this._active = true;
    this._showPanel();
    document.addEventListener('keydown', this._onKey, true);
    this._onScroll = () => this._repositionHighlights();
    window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this._onScroll);
  }

  deactivate() {
    this._active = false;
    document.removeEventListener('keydown', this._onKey, true);
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onScroll);
    this._clearHighlights();
    this.panel?.remove();
    this.panel = null;
    this.matches = [];
    this.current = -1;
  }

  destroy() { this.deactivate(); }

  _showPanel() {
    if (this.panel) return;
    const p = document.createElement('div');
    p.className = `argus-panel theme-${this.tb.theme}`;

    const CHIPS = ['img', 'a', 'button', 'input'];

    p.innerHTML = `
      <div class="panel-label">Search</div>
      <input class="argus-search-input" placeholder="Text or CSS selector…" autocomplete="off" spellcheck="false"/>
      <div class="search-chips">
        ${CHIPS.map(c => `<button class="search-chip" data-q="${c}">${c}</button>`).join('')}
      </div>
      <div class="search-count"></div>
      <div class="search-nav">
        <button class="search-nav-btn" id="argus-s-prev">↑ Prev</button>
        <button class="search-nav-btn" id="argus-s-next">↓ Next</button>
      </div>
    `;

    this.input   = p.querySelector('.argus-search-input');
    this.countEl = p.querySelector('.search-count');
    this.input.addEventListener('input', () => this._search(this.input.value));
    p.querySelector('#argus-s-prev').addEventListener('click', () => this._stepMatch(-1));
    p.querySelector('#argus-s-next').addEventListener('click', () => this._stepMatch(1));

    p.querySelectorAll('.search-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const q = chip.dataset.q;
        this.input.value = q;
        this._search(q);
        this._updateChips(q);
        this.input.focus();
      });
    });

    this.tb.shadow.appendChild(p);
    this.panel = p;
    this._positionPanel();

    requestAnimationFrame(() => this.input.focus());
  }

  _positionPanel() {
    if (!this.panel) return;
    const rail = this.tb.rail.getBoundingClientRect();
    const p    = this.tb.placement;
    const gap  = 6;
    const M    = 8;

    Object.assign(this.panel.style, { top: '0px', left: '0px' });
    const pw = this.panel.getBoundingClientRect().width;
    const ph = this.panel.getBoundingClientRect().height;

    let top, left;
    if (p === 'left')        { left = rail.right + gap;     top = rail.top; }
    else if (p === 'right')  { left = rail.left - pw - gap; top = rail.top; }
    else if (p === 'top')    { top  = rail.bottom + gap;    left = rail.left; }
    else                     { top  = rail.top - ph - gap;  left = rail.left; }

    left = Math.max(M, Math.min(left, window.innerWidth  - pw - M));
    top  = Math.max(M, Math.min(top,  window.innerHeight - ph - M));
    Object.assign(this.panel.style, { top: `${top}px`, left: `${left}px` });
  }

  _updateChips(activeQuery) {
    this.panel?.querySelectorAll('.search-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.q === activeQuery);
    });
  }

  _search(query) {
    this._updateChips(query);
    this._clearHighlights();
    this.matches = [];
    this.current = -1;
    if (!query.trim()) { this.countEl.textContent = ''; return; }

    // Try CSS selector first, fall back to text search
    let candidates = [];
    try {
      candidates = [...document.querySelectorAll(query)].filter(el => !isArgus(el, this.tb.shadow));
    } catch {
      // Text search
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          if (isArgus(n.parentElement, this.tb.shadow)) return NodeFilter.FILTER_REJECT;
          return n.textContent.toLowerCase().includes(query.toLowerCase())
            ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      });
      let node;
      while ((node = walker.nextNode())) candidates.push(node.parentElement);
      // Dedupe
      candidates = [...new Set(candidates)];
    }

    this.matches = candidates;
    this.countEl.textContent = candidates.length
      ? `${candidates.length} match${candidates.length > 1 ? 'es' : ''}`
      : 'No matches';

    candidates.forEach(el => {
      const hl = document.createElement('div');
      hl.className = 'argus-highlight search-match';
      const r = el.getBoundingClientRect();
      Object.assign(hl.style, {
        top: `${r.top}px`, left: `${r.left}px`,
        width: `${r.width}px`, height: `${r.height}px`,
      });
      this.tb.shadow.appendChild(hl);
      this.hls.push(hl);
    });

    if (candidates.length) this._goTo(0);
  }

  _stepMatch(dir) {
    if (!this.matches.length) return;
    this._goTo((this.current + dir + this.matches.length) % this.matches.length);
  }

  _goTo(index) {
    // Reset previous current
    if (this.current >= 0 && this.hls[this.current]) {
      this.hls[this.current].className = 'argus-highlight search-match';
    }
    this.current = index;
    if (this.hls[index]) {
      this.hls[index].className = 'argus-highlight search-current';
    }
    this.matches[index]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.countEl.textContent = `${index + 1} / ${this.matches.length}`;
  }

  _repositionHighlights() {
    this.matches.forEach((el, i) => {
      if (!this.hls[i]) return;
      const r = el.getBoundingClientRect();
      Object.assign(this.hls[i].style, {
        top: `${r.top}px`, left: `${r.left}px`,
        width: `${r.width}px`, height: `${r.height}px`,
      });
    });
  }

  _clearHighlights() {
    this.hls.forEach(h => h.remove());
    this.hls = [];
  }

  onEsc() {
    if (this.input) this.input.value = '';
    this._search('');
  }

  _onKeyDown(e) {
    if (!this._active) return;
    if (e.key === '/' && document.activeElement !== this.input) {
      e.preventDefault();
      this.input?.focus();
      return;
    }
    if (e.key === 'Enter' && document.activeElement === this.input) {
      e.preventDefault();
      this._stepMatch(e.shiftKey ? -1 : 1);
    }
    // Esc is handled by toolbar's global escHandler → onEsc() + deactivate
  }

  setTheme(theme) { this.panel?.setAttribute('class', `argus-panel theme-${theme}`); }
  setPlacement()  { this._positionPanel(); }
}
