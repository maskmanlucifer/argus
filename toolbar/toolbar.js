import { InspectTool }   from '../tools/inspect.js';
import { TypographyTool } from '../tools/typography.js';
import { SearchTool }     from '../tools/search.js';
import { RulerTool }      from '../tools/ruler.js';
import { OutlineTool }    from '../tools/outline.js';
import { ColorTool }      from '../tools/color.js';
import { ViewportTool }   from '../tools/viewport.js';
import { GridTool }       from '../tools/grid.js';

const TOOLS = [
  {
    id: 'inspect', title: 'Inspect',
    desc: 'Hover to highlight an element, click to pin it. Shows tag, class, font, and colors.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/></svg>`,
  },
  {
    id: 'type', title: 'Typography',
    desc: 'Hover any element to see its font family, size, and weight.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`,
  },
  {
    id: 'search', title: 'Search',
    desc: 'Find elements by CSS selector or text. Enter / Shift+Enter to cycle matches.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  },
  {
    id: 'ruler', title: 'Rulers',
    desc: 'Add full-screen guide lines. Hover a line to select or delete it. Drag or type a position. Select one line and hover another to see the gap.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v4H3z"/><path d="M3 17h18v4H3z"/><line x1="7" y1="7" x2="7" y2="17"/><line x1="12" y1="7" x2="12" y2="17"/><line x1="17" y1="7" x2="17" y2="17"/></svg>`,
  },
  {
    id: 'outline', title: 'Outlines',
    desc: 'Toggle a 1px outline on every element to see the page structure at a glance.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>`,
  },
  {
    id: 'color', title: 'Color Picker',
    desc: 'Pick any color from the page. Shows HEX, RGB, and HSL values with one-click copy.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8"/></svg>`,
  },
  {
    id: 'viewport', title: 'Screen Size',
    desc: 'Resize the browser window to a common breakpoint or type any width for pixel-perfect sizing.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M8 10h8M8 10l2-2M8 10l2 2M16 10l-2-2M16 10l-2 2"/></svg>`,
  },
  {
    id: 'grid', title: 'Grid',
    desc: 'Overlay a column grid and baseline grid on the page. Configure columns, gutter, margin, and baseline unit.',
    icon: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
  },
];

const UTILITY_GUIDES = {
  theme: {
    title: 'Switch Theme',
    desc:  'Toggle the toolbar between dark and light mode.',
  },
  placement: {
    title: 'Move Toolbar',
    desc:  'Cycle the dock position: left → top → right → bottom.',
  },
  feedback: {
    title: 'Send Feedback',
    desc:  'Report a bug or request a feature — opens your email client.',
  },
};

const PLACEMENTS = ['left', 'top', 'right', 'bottom'];

const PLACEMENT_ICONS = {
  left:   `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>`,
  top:    `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>`,
  right:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  bottom: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/></svg>`,
};

const SUN_ICON      = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.93 1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const MOON_ICON     = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
const CLOSE_ICON    = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`;
const FEEDBACK_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

export class Toolbar {
  constructor({ shadow, container, host }) {
    this.shadow    = shadow;
    this.container = container;
    this.host      = host;

    this.activeTool = null;
    this.hoverTool  = null;
    this._guideTimer = null;
    this._visible = true;

    this._loadState().then(() => this._render());
  }

  async _loadState() {
    const data = await chrome.storage.local.get(['argus_theme', 'argus_placement']);
    this.theme     = data.argus_theme     || 'light';
    this.placement = data.argus_placement || 'right';
  }

  _saveState() {
    chrome.storage.local.set({ argus_theme: this.theme, argus_placement: this.placement });
  }

  _render() {
    this.container.innerHTML = '';

    // ── Rail ──
    this.rail = document.createElement('div');
    this.rail.id = 'argus-rail';
    this.rail.className = `placement-${this.placement} theme-${this.theme}`;

    // Tool buttons
    TOOLS.forEach(t => {
      const btn = document.createElement('button');
      btn.className = 'argus-btn';
      btn.dataset.tool = t.id;
      btn.innerHTML = t.icon;
      if (this.activeTool === t.id) btn.classList.add('active');
      btn.addEventListener('click',      (e) => { e.stopPropagation(); this._selectTool(t.id); });
      btn.addEventListener('mouseenter', () => this._onHover(t.id, btn));
      btn.addEventListener('mouseleave', () => this._onLeave());
      this.rail.appendChild(btn);
    });

    // Divider
    const div = document.createElement('div');
    div.className = 'argus-divider';
    this.rail.appendChild(div);

    // Theme toggle
    const themeBtn = document.createElement('button');
    themeBtn.className = 'argus-btn';
    themeBtn.id = 'argus-theme-btn';
    themeBtn.innerHTML = this.theme === 'dark' ? SUN_ICON : MOON_ICON;
    themeBtn.addEventListener('click',      (e) => { e.stopPropagation(); this._toggleTheme(); });
    themeBtn.addEventListener('mouseenter', () => this._onHover('theme', themeBtn));
    themeBtn.addEventListener('mouseleave', () => this._onLeave());
    this.rail.appendChild(themeBtn);

    // Placement
    const placeBtn = document.createElement('button');
    placeBtn.className = 'argus-btn';
    placeBtn.id = 'argus-place-btn';
    placeBtn.innerHTML = PLACEMENT_ICONS[this.placement];
    placeBtn.addEventListener('click',      (e) => { e.stopPropagation(); this._cyclePlacement(); });
    placeBtn.addEventListener('mouseenter', () => this._onHover('placement', placeBtn));
    placeBtn.addEventListener('mouseleave', () => this._onLeave());
    this.rail.appendChild(placeBtn);

    // Feedback
    const feedbackBtn = document.createElement('button');
    feedbackBtn.className = 'argus-btn';
    feedbackBtn.id = 'argus-feedback-btn';
    feedbackBtn.innerHTML = FEEDBACK_ICON;
    feedbackBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open('mailto:brightpixellabs@gmail.com?subject=Argus%20Inspector%20%E2%80%93%20Bug%20Report%20%2F%20Feature%20Request', '_blank');
    });
    feedbackBtn.addEventListener('mouseenter', () => this._onHover('feedback', feedbackBtn));
    feedbackBtn.addEventListener('mouseleave', () => this._onLeave());
    this.rail.appendChild(feedbackBtn);

    // Close
    const closeBtn = document.createElement('button');
    closeBtn.className = 'argus-btn';
    closeBtn.innerHTML = CLOSE_ICON;
    closeBtn.addEventListener('click', () => this._destroy());
    this.rail.appendChild(closeBtn);

    this.container.appendChild(this.rail);

    // ── Guide popover ──
    this.guide = document.createElement('div');
    this.guide.id = 'argus-guide';
    this.guide.className = `hidden theme-${this.theme}`;
    this.container.appendChild(this.guide);

    // ── Breakpoint badge ──
    this.bpBadge = document.createElement('div');
    this.bpBadge.id = 'argus-bp-badge';
    this._updateBpBadge();
    this.container.appendChild(this.bpBadge);
    this._resizeHandler = () => this._updateBpBadge();
    window.addEventListener('resize', this._resizeHandler);

    // ── Tool instances ──
    this.tools = {
      inspect:  new InspectTool(this),
      type:     new TypographyTool(this),
      search:   new SearchTool(this),
      ruler:    new RulerTool(this),
      outline:  new OutlineTool(this),
      color:    new ColorTool(this),
      viewport: new ViewportTool(this),
      grid:     new GridTool(this),
    };

    // Esc deactivates the active tool
    this._escHandler = (e) => {
      if (e.key !== 'Escape' || !this.activeTool) return;
      const active = this.tools[this.activeTool];
      // Let the tool handle Esc internally first (e.g. Edit cancels, Search clears)
      // then deactivate so its handlers go silent
      active?.onEsc?.();
      this._deactivate();
    };
    document.addEventListener('keydown', this._escHandler, true);

    this._positionRail();
    if (!this._visible) this.rail.classList.add('hidden');
  }

  _positionRail() {
    const p = this.placement;
    const r = this.rail.style;
    r.left = r.right = r.top = r.bottom = r.transform = '';
    if (p === 'left')   { r.left = '16px';   r.top = '50%';  r.transform = 'translateY(-50%)'; }
    if (p === 'right')  { r.right = '16px';  r.top = '50%';  r.transform = 'translateY(-50%)'; }
    if (p === 'top')    { r.top = '16px';    r.left = '50%'; r.transform = 'translateX(-50%)'; }
    if (p === 'bottom') { r.bottom = '16px'; r.left = '50%'; r.transform = 'translateX(-50%)'; }
  }

  // ── Tool activation ──
  _selectTool(id) {
    this._onLeave(); // always dismiss any pending/visible hover tooltip on click
    if (this.activeTool === id) {
      this._deactivate();
      return;
    }
    if (this.activeTool) this._deactivate(false);
    this.activeTool = id;
    this._updateButtons();
    this.tools[id]?.activate();
  }

  _deactivate(rerender = true) {
    if (this.activeTool) {
      this.tools[this.activeTool]?.deactivate();
      this.activeTool = null;
    }
    if (rerender) this._updateButtons();
  }

  _updateButtons() {
    this.rail.querySelectorAll('.argus-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === this.activeTool);
    });
  }

  // ── Guide popover ──
  _onHover(id, btn) {
    clearTimeout(this._guideTimer);
    this._guideTimer = setTimeout(() => this._showGuide(id, btn), 350);
  }

  _onLeave() {
    clearTimeout(this._guideTimer);
    this._hideGuide();
  }

  _showGuide(id, btn) {
    if (this.activeTool === id) return;
    if (Object.values(this.tools).some(t => t.panel)) return;
    const data = TOOLS.find(x => x.id === id) || UTILITY_GUIDES[id];
    if (!data || !btn || !this.guide) return;

    const escHint = (data !== UTILITY_GUIDES.theme && data !== UTILITY_GUIDES.placement)
      ? `<div class="guide-esc">Esc to dismiss</div>` : '';
    this.guide.innerHTML = `
      <div class="guide-title">${data.title}</div>
      <div class="guide-desc">${data.desc}</div>
      ${escHint}
    `;
    this.guide.className = `theme-${this.theme}`;

    const railRect = this.rail.getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();
    const p        = this.placement;
    const OFFSET   = 6;

    if (this._guideRaf) cancelAnimationFrame(this._guideRaf);
    this._guideRaf = requestAnimationFrame(() => {
      this._guideRaf = null;
      if (!this.guide) return; // toolbar may have been destroyed before RAF fired
      const gw = this.guide.offsetWidth;
      const gh = this.guide.offsetHeight;
      let top, left;

      if (p === 'left') {
        left = railRect.right + OFFSET;
        top  = btnRect.top + btnRect.height / 2 - 30;
      } else if (p === 'right') {
        left = railRect.left - gw - OFFSET;
        top  = btnRect.top + btnRect.height / 2 - 30;
      } else if (p === 'top') {
        top  = railRect.bottom + OFFSET;
        left = btnRect.left + btnRect.width / 2 - 30;
      } else {
        top  = railRect.top - gh - OFFSET;
        left = btnRect.left + btnRect.width / 2 - 30;
      }

      top  = Math.max(8, Math.min(top,  window.innerHeight - gh - 8));
      left = Math.max(8, Math.min(left, window.innerWidth  - gw - 8));

      this.guide.style.top  = `${top}px`;
      this.guide.style.left = `${left}px`;
    });
  }

  _hideGuide() {
    if (this._guideRaf) { cancelAnimationFrame(this._guideRaf); this._guideRaf = null; }
    this.guide?.classList.add('hidden');
  }

  // ── Theme ──
  _toggleTheme() {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this._applyTheme();
    this._saveState();
  }

  _applyTheme() {
    this.rail.className = `placement-${this.placement} theme-${this.theme}`;
    // Preserve hidden state — only swap the theme class
    const guideHidden = this.guide.classList.contains('hidden');
    this.guide.className = `theme-${this.theme}${guideHidden ? ' hidden' : ''}`;
    this.rail.querySelector('#argus-theme-btn').innerHTML = this.theme === 'dark' ? SUN_ICON : MOON_ICON;
    Object.values(this.tools).forEach(t => t.setTheme?.(this.theme));
  }

  // ── Placement ──
  _cyclePlacement() {
    this._hideGuide();
    this._deactivate();
    const i = PLACEMENTS.indexOf(this.placement);
    this.placement = PLACEMENTS[(i + 1) % PLACEMENTS.length];
    this._applyPlacement();
    this._saveState();
  }

  _applyPlacement() {
    this.rail.className = `placement-${this.placement} theme-${this.theme}`;
    this.rail.querySelector('#argus-place-btn').innerHTML = PLACEMENT_ICONS[this.placement];
    this._positionRail();
    Object.values(this.tools).forEach(t => t.setPlacement?.(this.placement));
  }

  // ── Breakpoint badge ──
  _updateBpBadge() {
    const w = window.innerWidth;
    let label = 'xs';
    if (w >= 1536) label = '2xl';
    else if (w >= 1280) label = 'xl';
    else if (w >= 1024) label = 'lg';
    else if (w >= 768)  label = 'md';
    else if (w >= 640)  label = 'sm';
    this.bpBadge.textContent = `${w}px · ${label}`;
  }

  // ── Visibility ──
  show()      { this._visible = true;  this.rail?.classList.remove('hidden'); }
  hide()      { this._visible = false; this._deactivate(false); this.rail?.classList.add('hidden'); }
  isVisible() { return this._visible; }
  toggle()    { this._visible ? this.hide() : this.show(); }

  // ── Cleanup registry — page-level DOM the extension injects outside shadow root ──
  // Tools call this.tb.trackPageNode(el) for anything appended to document/head.
  // _destroy() removes all of them so nothing leaks into the host page.
  trackPageNode(node) {
    if (!this._pageNodes) this._pageNodes = new Set();
    this._pageNodes.add(node);
  }

  // ── Destroy ──
  _destroy() {
    this._hideGuide();
    this.guide = null; // sentinel: any stale RAF that slips through will bail at the null-check
    this._deactivate(false);
    Object.values(this.tools).forEach(t => t.destroy?.());
    this._pageNodes?.forEach(n => n.remove());
    this._pageNodes = null;
    document.removeEventListener('keydown', this._escHandler, true);
    window.removeEventListener('resize', this._resizeHandler);
    this.host.remove();
    // Null the global ref so content.js listener and popup know the toolbar is gone.
    // __argusLoaded stays true — the existing message listener re-mounts on next click.
    window.__argus_toolbar = null;
  }
}
