const STYLE_ID = 'argus-outline-style';

export class OutlineTool {
  constructor(toolbar) {
    this.tb     = toolbar;
    this.active = false;
  }

  activate() {
    this.active = !this.active;
    this._apply();
    // If toggled off via button, deactivate the tool state too
    if (!this.active) {
      this.tb._deactivate();
    }
  }

  deactivate() {
    this.active = false;
    this._apply();
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
        // Register with toolbar so _destroy() cleans it up
        this.tb.trackPageNode(style);
      }
    } else {
      existing?.remove();
    }
  }
}
