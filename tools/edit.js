export class EditTool {
  constructor(toolbar) {
    this.tb          = toolbar;
    this.editing     = null;
    this.origText    = '';
    this.hl          = null;
    this._active     = false;
    this._onMove     = this._onMouseMove.bind(this);
    this._onDblClick = this._onDoubleClick.bind(this);
    this._onKey      = this._onKeyDown.bind(this);
  }

  activate() {
    this._active = true;
    this._createHighlight();
    document.addEventListener('mousemove',  this._onMove,     true);
    document.addEventListener('dblclick',   this._onDblClick, true);
    document.addEventListener('keydown',    this._onKey,      true);
    document.body.style.cursor = 'text';
  }

  deactivate() {
    this._active = false;
    this._cancelEdit();
    document.removeEventListener('mousemove',  this._onMove,     true);
    document.removeEventListener('dblclick',   this._onDblClick, true);
    document.removeEventListener('keydown',    this._onKey,      true);
    document.body.style.cursor = '';
    this._removeHighlight();
  }

  destroy() { this.deactivate(); }

  _createHighlight() {
    const el = document.createElement('div');
    el.className = 'argus-highlight';
    this.tb.shadow.appendChild(el);
    this.hl = el;
  }

  _removeHighlight() { this.hl?.remove(); this.hl = null; }

  _onMouseMove(e) {
    if (!this._active || this.editing) return;
    const target = this._textTarget(e.target);
    if (!target) { if (this.hl) this.hl.style.display = 'none'; return; }
    const r = target.getBoundingClientRect();
    Object.assign(this.hl.style, {
      top: `${r.top}px`, left: `${r.left}px`,
      width: `${r.width}px`, height: `${r.height}px`, display: 'block',
    });
  }

  _onDoubleClick(e) {
    if (!this._active || this._isArgus(e.target)) return;
    const target = this._textTarget(e.target);
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    this._startEdit(target);
  }

  _startEdit(el) {
    this._cancelEdit();
    this.editing  = el;
    this.origText = el.textContent;
    el.contentEditable = 'true';
    el.style.outline = '2px solid #2170F4';
    el.focus();
    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    if (this.hl) this.hl.style.display = 'none';
  }

  onEsc() { this._cancelEdit(); }

  _onKeyDown(e) {
    if (!this._active || !this.editing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._commitEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // toolbar's escHandler will call onEsc() + deactivate
    }
  }

  _commitEdit() {
    if (!this.editing) return;
    this.editing.contentEditable = 'false';
    this.editing.style.outline = '';
    this.editing = null;
  }

  _cancelEdit() {
    if (!this.editing) return;
    this.editing.textContent    = this.origText;
    this.editing.contentEditable = 'false';
    this.editing.style.outline  = '';
    this.editing = null;
  }

  _textTarget(el) {
    if (!el || this._isArgus(el)) return null;
    // Walk up to find a node that has direct text
    let node = el;
    while (node && node !== document.body) {
      if ([...node.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  _isArgus(el) {
    return el?.closest?.('#argus-host') || el?.getRootNode?.() === this.tb.shadow;
  }
}
