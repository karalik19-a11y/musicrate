#!/usr/bin/env node
/**
 * Builds the client as a *static* GitHub Pages site.
 *
 * Output layout (all committed, because Pages in "deploy from a branch" mode
 * publishes files, it does not run a build):
 *
 *   docs/index.html      the app itself (relative asset URLs + hash router)
 *   docs/assets/*        hashed js/css/woff2
 *   docs/404.html        copy of index.html so unknown paths still boot
 *   index.html           tiny launcher at the site root → ./docs/ (keeps ?query and #hash)
 *   404.html             same launcher for unknown root paths
 *   .nojekyll            skip Jekyll so the bundle is served byte-for-byte
 *
 * Deep links live in the hash (`/#/track/abc`), which is exactly why they work
 * on a static host without any rewrite rules. Telegram injects its own
 * #tgWebAppData=... into the hash, so the launcher must preserve search+hash
 * and the client must normalize it before the router starts.
 *
 * Usage: npm run pages:build   (then commit docs/ + index.html)
 *
 * A Pages site has no server of its own, so it must point at the shared API.
 * `VITE_API_URL` (or `MUSICRATE_API_URL`) can override the default Render
 * service URL when the project is deployed somewhere else.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'client', 'dist');
const outDir = path.join(root, 'docs');

// GitHub Pages is only a static shell. Without an API every browser gets its
// own IndexedDB vault, which makes an artist's uploads invisible to guests on
// other devices. Keep the public Pages build on the shared production API by
// default, while allowing forks and self-hosted deployments to override it.
const pagesApiUrl =
  process.env.VITE_API_URL ?? process.env.MUSICRATE_API_URL ?? 'https://musicrate.onrender.com';

const LAUNCHER = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>MUSICRATE</title>
    <meta name="theme-color" content="#060607" />
    <meta name="robots" content="noindex" />
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        background: #060607;
      }
    </style>
    <meta http-equiv="refresh" content="0; url=./docs/index.html" />
    <link rel="canonical" href="./docs/index.html" />
  </head>
  <body>
    <script>
      // GitHub Pages root launcher → ./docs/index.html
      // Must preserve ?query and #hash — Telegram injects its launch data
      // into #hash as #tgWebAppData=... which would otherwise be lost and
      // the app would show "LOST IN THE MIX" (NotFound).
      // Also preserve tgWebAppStartParam for track deep links.
      (function () {
        var search = location.search || '';
        var hash = location.hash || '';
        var target = './docs/index.html' + search + hash;
        try {
          var path = location.pathname;
          var segs = path.split('/').filter(Boolean);
          var base = segs.length ? '/' + segs[0] + '/' : '/';
          if (path.indexOf('/docs/') === -1 && segs.length > 1) {
            // Deep path like /musicrate/track/123 served as 404 — use absolute base
            target = base + 'docs/index.html' + search + hash;
          }
        } catch (e) {}
        location.replace(target);
      })();
    </script>
    <p style="font:14px/1.6 ui-sans-serif,system-ui,sans-serif;color:#8a8a95;padding:24px">
      <a style="color:#d7ff3f" href="./docs/index.html">Открыть MUSICRATE</a>
    </p>
  </body>
</html>
`;

function build() {
  console.log('[pages] vite build (PAGES=1)');
  execFileSync('npm', ['run', 'build', '--silent'], {
    cwd: path.join(root, 'client'),
    env: { ...process.env, PAGES: '1', VITE_API_URL: pagesApiUrl },
    stdio: 'inherit',
  });
}

function sync() {
  const keep = new Set(['screenshots']); // README images live next to the bundle
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (keep.has(entry.name)) continue;
    fs.rmSync(path.join(outDir, entry.name), { recursive: true, force: true });
  }
  fs.cpSync(dist, outDir, { recursive: true });
  fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));

  fs.writeFileSync(path.join(root, 'index.html'), LAUNCHER);
  fs.copyFileSync(path.join(root, 'index.html'), path.join(root, '404.html'));
  fs.writeFileSync(path.join(root, '.nojekyll'), '');

  const files = fs.readdirSync(outDir);
  const bytes = sizeOf(outDir);
  console.log(`[pages] ${outDir} → ${files.join(', ')}`);
  console.log(`[pages] ${(bytes / 1024).toFixed(0)} KB total`);
}

function sizeOf(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? sizeOf(full) : fs.statSync(full).size;
  }
  return total;
}

build();
sync();
