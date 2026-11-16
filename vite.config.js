import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Fills in the service worker: a new cache name on every build and the list
// of files to download when it installs (so it works offline right away).
const stampServiceWorker = {
  name: 'stamp-service-worker',
  apply: 'build',
  closeBundle() {
    const dist = fileURLToPath(new URL('./dist', import.meta.url));
    const files = readdirSync(dist, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        `${entry.parentPath ?? entry.path}/${entry.name}`
          .slice(dist.length + 1)
          .replaceAll('\\', '/')
      )
      .filter((path) => path !== 'sw.js' && !path.endsWith('.woff')) // woff2 is enough
      .map((path) => JSON.stringify(`./${path}`));

    const file = `${dist}/sw.js`;
    const code = readFileSync(file, 'utf8')
      .replaceAll('__BUILD_ID__', Date.now().toString(36))
      .replace('/*__PRECACHE__*/', `, ${files.join(', ')}`);
    writeFileSync(file, code);
  },
};

// base './' makes every asset path relative, so the same build works inside the
// Android app (Capacitor) and on any web host, including a GitHub Pages subfolder.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [stampServiceWorker],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
