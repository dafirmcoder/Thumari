import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import path from 'node:path';
import fs from 'node:fs';
import { PUBLIC_DIR } from '../paths.js';

export function registerPwaRoutes(app: FastifyInstance, config: AppConfig) {
  // Service Worker route with Service-Worker-Allowed root scope header
  app.get('/sw.js', async (request, reply) => {
    const swPath = path.join(PUBLIC_DIR, 'sw.js');
    if (fs.existsSync(swPath)) {
      reply.header('Content-Type', 'application/javascript');
      reply.header('Service-Worker-Allowed', '/');
      reply.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      return reply.send(fs.readFileSync(swPath, 'utf8'));
    }
    return reply.status(404).send('Service worker not found');
  });

  // Dynamic Web Manifest
  app.get('/manifest.webmanifest', async (request, reply) => {
    const manifest = {
      id: '/',
      name: config.org.name,
      short_name: 'Thumari',
      description: config.org.tagline,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
      background_color: '#0f172a',
      theme_color: '#0284c7',
      orientation: 'portrait-primary',
      categories: ['finance', 'business', 'productivity'],
      icons: [
        {
          src: '/static/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/static/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/static/icons/icon-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
      shortcuts: [
        {
          name: 'Dashboard',
          url: '/dashboard',
          icons: [{ src: '/static/icons/icon-192.png', sizes: '192x192' }],
        },
        {
          name: 'Contributions',
          url: '/contributions',
          icons: [{ src: '/static/icons/icon-192.png', sizes: '192x192' }],
        },
        {
          name: 'Loans',
          url: '/loans',
          icons: [{ src: '/static/icons/icon-192.png', sizes: '192x192' }],
        },
      ],
      related_applications: [
        {
          platform: 'play',
          url: `https://play.google.com/store/apps/details?id=${config.android.packageName}`,
          id: config.android.packageName,
        },
      ],
    };

    reply.header('Content-Type', 'application/manifest+json');
    return reply.send(manifest);
  });

  // Digital Asset Links for Android TWA verification
  app.get('/.well-known/assetlinks.json', async (request, reply) => {
    const certFingerprints = config.android.certFingerprints;
    const assetlinks = [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: config.android.packageName,
          sha256_cert_fingerprints: certFingerprints.length > 0 ? certFingerprints : [
            '14:6D:E9:7D:0F:52:AB:E6:EC:65:C4:B8:BC:21:AE:B8:70:50:C0:79:02:4F:10:04:6D:4D:09:9B:0F:7B:6C:A5',
          ],
        },
      },
    ];

    reply.header('Content-Type', 'application/json');
    return reply.send(assetlinks);
  });

  // Offline Fallback Route
  app.get('/offline', async (request, reply) => {
    const offlinePath = path.join(PUBLIC_DIR, 'offline.html');
    if (fs.existsSync(offlinePath)) {
      reply.header('Content-Type', 'text/html');
      return reply.send(fs.readFileSync(offlinePath, 'utf8'));
    }
    return reply.send('<h1>You are currently offline</h1><p>Please reconnect to the internet to access Thumari.</p>');
  });
}
