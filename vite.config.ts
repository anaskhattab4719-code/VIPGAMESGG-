import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

function collectBuildAssets(dir: string, baseDir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectBuildAssets(full, baseDir));
    } else if (/\.(js|css|png|ico|svg|woff2?)$/i.test(entry.name) && entry.name !== 'sw.js') {
      const rel = '/' + path.relative(baseDir, full).replace(/\\/g, '/');
      results.push(rel);
    }
  }
  return results;
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          // Inject built hashed bundle filenames into dist/sw.js for full offline precaching
          const swPath = path.join(distDir, 'sw.js');
          if (fs.existsSync(swPath)) {
            const assets = collectBuildAssets(distDir, distDir).filter(
              (a) =>
                ![
                  '/',
                  '/index.html',
                  '/manifest.json',
                  '/apple-touch-icon.png',
                  '/pwa-192x192.png',
                  '/pwa-512x512.png',
                  '/pwa-maskable-192x192.png',
                  '/pwa-maskable-512x512.png',
                  '/vip-ai-icon-512.png',
                  '/vip-ai-splash-logo.png',
                ].includes(a),
            );
            const injected = assets.map((a) => `  '${a}'`).join(',\n');
            const original = fs.readFileSync(swPath, 'utf8');
            const updated = original.replace('/*__VIP_AI_BUILD_ASSETS__*/', injected);
            fs.writeFileSync(swPath, updated, 'utf8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
