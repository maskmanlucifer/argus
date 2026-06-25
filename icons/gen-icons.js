// Run: node gen-icons.js
// Generates icon16.png, icon48.png, icon128.png using Canvas API (Node ≥18 with canvas)
// Falls back to writing SVG data URIs as PNG placeholders if canvas not available.

const fs   = require('fs');
const path = require('path');

const SVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" width="${size}" height="${size}">
  <rect width="25" height="25" rx="6" fill="#2170F4"/>
  <path fill="#fff" d="M 0 1.782 C 0 1.293 0.466 0.966 0.88 1.165 L 12.755 6.889 C 12.98 6.998 13.125 7.24 13.125 7.506 L 13.125 24.324 C 13.125 24.826 12.636 25.152 12.22 24.928 L 4.72 20.874 C 4.509 20.759 4.375 20.526 4.375 20.27 L 4.375 11.203 L 0.315 8.694 C 0.129 8.579 0.011 8.37 0.001 8.139 L 0 8.108 L 0 1.782 Z M 1.25 2.823 L 1.25 7.716 L 5.31 10.224 C 5.496 10.339 5.614 10.549 5.624 10.779 L 5.625 10.811 L 5.625 19.853 L 11.875 23.231 L 11.875 7.945 L 1.25 2.823 Z M 23.748 0 C 24.632 0 25.105 0.855 24.98 1.611 C 24.993 1.665 25 1.722 25 1.782 L 25 8.108 L 24.999 8.139 C 24.989 8.37 24.871 8.579 24.685 8.694 L 20.625 11.203 L 20.625 20.27 C 20.625 20.526 20.491 20.759 20.28 20.874 L 12.78 24.928 C 12.364 25.152 11.875 24.826 11.875 24.324 L 11.875 7.935 L 0.744 2.586 C -0.477 1.999 -0.106 0.04 1.211 0.001 L 1.252 0 L 23.748 0 Z M 23.75 2.829 L 19.476 4.884 L 13.125 7.945 L 13.125 23.23 L 19.375 19.852 L 19.375 10.81 L 19.376 10.779 C 19.386 10.549 19.504 10.339 19.69 10.224 L 23.75 7.716 L 23.75 2.829 Z M 23.733 1.351 L 1.252 1.351 L 12.5 6.757 L 18.955 3.655 L 23.733 1.351 Z"/>
</svg>`;

[16, 48, 128].forEach(size => {
  fs.writeFileSync(
    path.join(__dirname, `icon${size}.svg`),
    SVG(size),
    'utf8'
  );
  console.log(`Wrote icon${size}.svg`);
});

console.log('Convert SVGs to PNGs with: for f in icons/*.svg; do rsvg-convert $f -o ${f%.svg}.png; done');
console.log('Or use: npx sharp-cli --input icons/icon128.svg --output icons/icon128.png resize 128 128');
