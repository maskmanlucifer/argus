# Argus Inspector

Lightweight design & inspect toolbar for the web. A minimal, modern alternative to VisBug.

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select this folder (`argus/`)
4. Pin the extension and click its icon — or press **Alt+Shift+A** on any tab

## Tools

| Key | Tool | What it does |
|-----|------|--------------|
| `I` | Inspect | Hover to highlight, click to pin one element. Shows tag, class, font, color, background. One-click CSS copy. |
| `T` | Typography | Hover any element — shows font family, size, weight. |
| `E` | Edit Text | Double-click text to edit inline. Enter saves, Esc cancels. |
| `/` | Search | CSS selector or text search, cycle matches with Enter / Shift+Enter. |
| `C` | Color | Eyedropper picks any color. Save to palette, right-click swatch to delete. |
| `R` | Rulers | Add full-screen H/V guide lines. Hover a line for Select / Delete chip. Drag to reposition or type exact px. Select a line then hover another to see the gap. |
| `O` | Outlines | Toggle 1px outline on every element. |

## Toolbar controls

- **Sun/Moon** — switch dark/light theme
- **Panel icon** — cycle dock position: left → top → right → bottom (remembered)
- **✕** — tear down everything on the page; click the extension icon to bring it back

## State persistence

Toolbar position and theme are saved to `chrome.storage.local` and restored on every open.
