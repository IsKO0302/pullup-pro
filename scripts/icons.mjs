// Generates PWA / Apple / favicon icons from one vector mark (no external assets).
// usage: node scripts/icons.mjs   (writes apps/web/public/icons/*; needs sharp: npm i --no-save sharp)
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../apps/web/public/icons/', import.meta.url));
mkdirSync(OUT, { recursive: true });

/** pull-up mark: bar + athlete with the chin over the bar. `s` scales the figure around the centre (maskable safe zone). */
const mark = (s = 1, ink = '#120700') => `<g transform="translate(256 256) scale(${s}) translate(-256 -256)" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" fill="none">
  <path d="M84 172H428" stroke-width="30"/>
  <path d="M196 172L170 264L224 230" stroke-width="28"/>
  <path d="M316 172L342 264L288 230" stroke-width="28"/>
  <path d="M256 236V334" stroke-width="70"/>
  <path d="M240 352L226 438M272 352L286 438" stroke-width="32"/>
  <circle cx="256" cy="126" r="40" fill="${ink}" stroke="none"/>
</g>`;
const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a1f"/><stop offset="1" stop-color="#ff2e2e"/></linearGradient>
  <radialGradient id="h" cx=".3" cy=".2" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>`;
const svg = ({ round = true, s = 1 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" rx="${round ? 112 : 0}" fill="url(#g)"/><rect width="512" height="512" rx="${round ? 112 : 0}" fill="url(#h)"/>${mark(s)}</svg>`;

const png = async (svgStr, size, name) => {
  await sharp(Buffer.from(svgStr), { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(OUT + name);
  console.log('icon', name, size);
};
await png(svg(), 192, 'icon-192.png');
await png(svg(), 512, 'icon-512.png');
await png(svg({ round: false, s: 0.78 }), 512, 'maskable-512.png');
await png(svg({ round: false, s: 0.78 }), 192, 'maskable-192.png');
await png(svg({ round: false, s: 0.86 }), 180, 'apple-touch-icon.png');
await png(svg(), 96, 'shortcut-96.png');
await png(svg(), 32, 'favicon-32.png');
writeFileSync(OUT + 'favicon.svg', svg());
console.log('icon favicon.svg');
