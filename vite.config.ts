import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import react from '@vitejs/plugin-react';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

const VANILLA_STATIC_SITES: Array<{ prefix: string; dir: string }> = [
  { prefix: '/radio-anthology', dir: 'radio-anthology' },
  { prefix: '/tracks', dir: 'tracks' },
];

function contentTypeForExt(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return map[ext] ?? 'application/octet-stream';
}

function vanillaStaticSitesDevPlugin(): Plugin {
  return {
    name: 'anthology-vanilla-static-sites-dev',
    configureServer(server) {
      server.middlewares.use(
        (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
          const rawUrl = req.url ?? '/';
          let pathname: string;
          try {
            pathname = decodeURI(rawUrl.split('?')[0] ?? '/');
          } catch {
            res.statusCode = 400;
            res.end('Bad Request');
            return;
          }

          const site = VANILLA_STATIC_SITES.find(
            (s) => pathname === s.prefix || pathname.startsWith(`${s.prefix}/`),
          );
          if (!site) {
            next();
            return;
          }

          if (pathname === site.prefix) {
            const q = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?')) : '';
            res.statusCode = 302;
            res.setHeader('Location', `${site.prefix}/${q}`);
            res.end();
            return;
          }

          let relativePath = pathname.slice(site.prefix.length + 1);
          if (relativePath === '' || relativePath === '/') {
            relativePath = 'index.html';
          }

          relativePath = path.normalize(relativePath);
          if (
            relativePath.startsWith(`..${path.sep}`) ||
            relativePath === '..' ||
            relativePath.startsWith('/')
          ) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }

          const normalizedRoot = path.resolve(__dirname, site.dir);
          const normalizedFile = path.resolve(normalizedRoot, relativePath);
          const relToRoot = path.relative(normalizedRoot, normalizedFile);
          if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }

          fs.stat(normalizedFile, (err, st) => {
            if (err || !st.isFile()) {
              res.statusCode = 404;
              res.end('Not Found');
              return;
            }
            res.setHeader('Content-Type', contentTypeForExt(normalizedFile));
            fs.createReadStream(normalizedFile).on('error', () => {
              if (!res.headersSent) res.statusCode = 500;
              res.end();
            }).pipe(res);
          });
        }
      );
    },
  };
}

export default defineConfig(({ mode }) => {
    loadEnv(mode, '.', '');

    // Environment validation (production only)
    if (mode === 'production') {
      // Optional: Validate required environment variables
      // const requiredVars = ['VITE_SENTRY_DSN']; // Example: make Sentry required
      // requiredVars.forEach((varName) => {
      //   if (!env[varName]) {
      //     console.warn(`Warning: ${varName} is not set. Some features may not work.`);
      //   }
      // });
    }
    
    return {
      root: __dirname,
      publicDir: 'public',
      appType: 'spa',
      server: {
        port: 5173,
        strictPort: true,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
            timeout: 15000,
          },
        },
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://127.0.0.1:3001',
            changeOrigin: true,
            timeout: 15000,
          },
        },
      },
      plugins: [
        vanillaStaticSitesDevPlugin(),
        react(),
        ViteImageOptimizer({
          png: {
            quality: 80
          },
          jpeg: {
            quality: 80
          },
          webp: {
            quality: 80
          },
          avif: {
            quality: 80
          },
          svg: {
            multipass: true
          },
          includePublic: true
        })
      ],
      resolve: {
        alias: {
          react: path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom'],
        preserveSymlinks: true
      },
      optimizeDeps: {
        include: ['react', 'react-dom']
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        // Minification optimization
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: mode === 'production', // Remove console.log in production
            drop_debugger: true,
            pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
            passes: 3, // Multiple passes for better compression
            unsafe: true, // Enable unsafe optimizations
            unsafe_comps: true,
            unsafe_math: true,
            unsafe_methods: true,
            unsafe_proto: true,
            unsafe_regexp: true,
            unsafe_undefined: true,
            dead_code: true, // Remove dead code
            unused: true, // Remove unused variables
          },
          format: {
            comments: false, // Remove comments
            ecma: 2020, // Target modern ECMAScript (terser ECMA max)
          },
          mangle: {
            safari10: false, // Don't mangle Safari 10 (not needed for modern browsers)
          },
        },
        // Source map strategy: minimal in production
        sourcemap: mode === 'production' ? false : true,
        // Chunk size optimization
        chunkSizeWarningLimit: 500, // Lower warning threshold for better optimization awareness
        // Report compressed size (gzip)
        reportCompressedSize: true,
        rollupOptions: {
          input: path.resolve(__dirname, 'index.html'),
          output: {
            manualChunks: (id) => {
              // More aggressive code splitting
              if (id.includes('node_modules')) {
                // Vendor chunks - split by library for better caching
                if (id.includes('framer-motion')) {
                  return 'framer-vendor';
                }
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                  return 'react-vendor';
                }
                if (id.includes('@sentry')) {
                  return 'sentry-vendor';
                }
                if (id.includes('dompurify')) {
                  return 'dompurify-vendor';
                }
                if (id.includes('@fontsource')) {
                  return 'fonts-vendor';
                }
                if (id.includes('@vercel')) {
                  return 'vercel-vendor';
                }
                // Other vendor libraries
                return 'vendor';
              }
              // Route-based splitting for better code splitting
              if (id.includes('components/StoryModal') || id.includes('data/storyContent')) {
                return 'story-modal';
              }
              if (id.includes('components/Timeline')) {
                return 'timeline';
              }
              if (id.includes('components/News') || id.includes('utils/newsService')) {
                return 'news';
              }
              // Utils splitting
              if (id.includes('utils/') && !id.includes('utils/newsService')) {
                // Group small utils together
                return 'utils';
              }
              return undefined;
            },
            // Optimize chunk file names
            chunkFileNames: 'assets/js/[name]-[hash].js',
            entryFileNames: 'assets/js/[name]-[hash].js',
            assetFileNames: (assetInfo) => {
              const info = assetInfo.name?.split('.') || [];
              const ext = info[info.length - 1];
              if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp|avif/i.test(ext)) {
                return 'assets/images/[name]-[hash].[ext]';
              }
              if (/woff2?|eot|ttf|otf/i.test(ext)) {
                return 'assets/fonts/[name]-[hash].[ext]';
              }
              return 'assets/[ext]/[name]-[hash].[ext]';
            },
          },
        },
        // Target modern browsers for smaller bundles
        target: 'es2022',
        // CSS code splitting
        cssCodeSplit: true,
        // Reduce asset inline limit (smaller files inline, larger files separate)
        assetsInlineLimit: 4096, // 4KB
      }
    };
  });
