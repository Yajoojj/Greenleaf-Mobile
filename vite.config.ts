/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

/**
 * Content Security Policy injetada só no build (o dev server do Vite precisa de scripts inline).
 * connect-src libera apenas a origem da API configurada.
 */
function contentSecurityPolicy(apiUrl: string | undefined): Plugin {
  let apiOrigin = '';
  try {
    if (apiUrl) apiOrigin = new URL(apiUrl).origin;
  } catch {
    apiOrigin = '';
  }
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'greenleaf-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    build: { sourcemap: false, target: 'es2021' },
    plugins: [
      react(),
      contentSecurityPolicy(env.VITE_API_URL),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['icons/*.png', 'icons/*.svg', 'demo/*'],
        manifest: {
          name: 'GreenLeaf — Bacteriose da mandioca',
          short_name: 'GreenLeaf',
          description: 'Fotografe uma folha de mandioca e veja uma estimativa de bacteriose, com a área suspeita destacada.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#F5F5F5',
          theme_color: '#24611F',
          categories: ['productivity', 'utilities'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // App + exemplos do modo demonstração ficam no cache: funciona em modo avião.
          globPatterns: ['**/*.{js,css,html,woff2,png,jpg,svg,webmanifest}'],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
          navigateFallback: '/index.html',
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
