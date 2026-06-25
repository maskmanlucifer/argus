# Argus Inspector

Lightweight design inspector for Chrome. Hover, pin, measure, and edit any element on any page — without opening DevTools.

**[Add to Chrome](https://chromewebstore.google.com/detail/argus-inspector/amnfopnhghblhhmmmmdpkbkikmlebpkn)** · **[Live page](https://maskmanlucifer.github.io/argus)**

---

## Features

| Key | Tool | Description |
|-----|------|-------------|
| `I` | **Inspect** | Hover to highlight an element, click to pin it. Shows tag, class, font, color, and background. One-click CSS copy. |
| `T` | **Typography** | Hover any element to see font family, size, and weight. |
| `E` | **Edit Text** | Double-click any text to edit inline. Enter saves, Esc cancels. |
| `/` | **Search** | Find by CSS selector or text. Cycle matches with Enter / Shift+Enter. |
| `R` | **Rulers** | Add full-screen H/V guide lines. Select one line, hover another to see the gap. |
| `O` | **Outlines** | Toggle a 1px outline on every element to see the page structure. |
| `Z` | **Zoom** | Scale the page in 10% steps. Resets when you switch tools. |

Toolbar controls: **Sun/Moon** to toggle theme · **Dock icon** to cycle position (left / top / right / bottom) · **✕** to close.

Theme and dock position are saved across sessions via `chrome.storage.local`.

---

## Install (unpacked)

1. Clone or download this repo
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** → select the `argus/` folder
4. Pin the extension and click its icon on any tab

---

## Contributing

1. **Fork** the repo and create a branch (`git checkout -b my-feature`)
2. Make your changes — each tool lives in `tools/<name>.js`
3. Test by reloading the extension in `chrome://extensions`
4. Open a **pull request** with a short description of what you changed

**Good first issues:** adding a new tool, improving an existing panel's UI, fixing a bug from the issue tracker.

Keep PRs focused — one change per PR makes review faster.

---

## Project structure

```
argus/
├── manifest.json       # Extension manifest (MV3)
├── background.js       # Service worker (minimal)
├── content.js          # Injects the toolbar into the page
├── popup/              # Extension popup (toggle button)
├── toolbar/            # Toolbar shell and CSS
└── tools/              # One file per tool
    ├── utils.js         # Shared helpers
    ├── inspect.js
    ├── typography.js
    ├── edit.js
    ├── search.js
    ├── ruler.js
    ├── outline.js
    └── zoom.js
```

---

Built by [maskmanlucifer](https://maskmanlucifer.github.io/lucifer/) · MIT License
