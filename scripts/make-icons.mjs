// Generates every icon from the SVG below.
//   npm run icons
// Then, for the Android launcher icons and splash:
//   npx capacitor-assets generate --android
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const GREEN_TOP = '#23b574';
const GREEN = '#1b9f64';

// Check mark + a small "grade bar" like the one on the subject cards.
// Everything stays inside the central 66% so adaptive icons never cut it.
const foreground = `
  <path d="M345 470 L465 590 L700 320" fill="none" stroke="#fff" stroke-width="92"
        stroke-linecap="round" stroke-linejoin="round"/>
  <g clip-path="url(#bar)">
    <rect x="330" y="664" width="150" height="60" fill="#fff"/>
    <rect x="490" y="664" width="92" height="60" fill="#fff" fill-opacity="0.8"/>
    <rect x="592" y="664" width="102" height="60" fill="#fff" fill-opacity="0.45"/>
  </g>
`;

const gradient = `<defs>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${GREEN_TOP}"/><stop offset="1" stop-color="${GREEN}"/>
  </linearGradient>
  <clipPath id="bar"><rect x="330" y="664" width="364" height="60" rx="30"/></clipPath>
</defs>`;

const svg = ({ rounded = false, background = true, fg = true, size = 1024 } = {}) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${gradient}
  ${background ? `<rect width="1024" height="1024" rx="${rounded ? 230 : 0}" fill="url(#g)"/>` : ''}
  ${fg ? foreground : ''}
</svg>`);

const png = (buffer, size, file) => sharp(buffer).resize(size, size).png().toFile(file);

mkdirSync('public/icons', { recursive: true });
mkdirSync('assets', { recursive: true });

// Source SVG, handy to edit the design.
writeFileSync('assets/icon.svg', svg({ rounded: true }));

// Web / PWA
await png(svg({ rounded: true }), 192, 'public/icons/icon-192.png');
await png(svg({ rounded: true }), 512, 'public/icons/icon-512.png');
await png(svg(), 512, 'public/icons/maskable-512.png');
await png(svg(), 180, 'public/icons/apple-touch-icon.png');
await png(svg({ rounded: true }), 32, 'public/icons/favicon-32.png');

// Sources for @capacitor/assets (Android launcher icon + splash)
await png(svg(), 1024, 'assets/icon-only.png');
await png(svg({ background: false }), 1024, 'assets/icon-foreground.png');
await png(svg({ fg: false }), 1024, 'assets/icon-background.png');

const splash = (bg) =>
  sharp({ create: { width: 2732, height: 2732, channels: 4, background: bg } })
    .composite([{ input: Buffer.from(svg({ rounded: true, size: 640 })), gravity: 'center' }])
    .png();
await splash(GREEN).toFile('assets/splash.png');
await splash(GREEN).toFile('assets/splash-dark.png');

console.log('Icons generated');
