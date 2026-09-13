# PWA Improvements & Audit Guide for Thumari

This document details the architecture, checklists, and improvements implemented to turn Thumari into an installable, offline-capable, grade-A Progressive Web App (PWA).

---

## 1. Web App Manifest Enhancements
- **Dynamic Manifest Route (`/manifest.webmanifest`)**: The manifest is served dynamically by Fastify, ensuring organization names, currencies, and package identifiers are injected seamlessly from the server configuration.
- **Icons**:
  - `icon-192.png` (192x192) standard icon for Android home screen and task switchers.
  - `icon-512.png` (512x512) high-resolution icon for splash screens and app stores.
  - `icon-maskable.png` (512x512 with safe padding) for Android adaptive icon shapes (circle, teardrop, squircle).
  - `apple-touch-icon.png` (180x180) for iOS Safari home screen bookmarks.
- **Display Modes**:
  - `display: standalone` removes browser UI elements (URL bar, navigation buttons).
  - `display_override: ["window-controls-overlay", "standalone", "minimal-ui"]` provides support for desktop window controls overlay.
- **App Shortcuts**: Quick launch targets for **Dashboard**, **Contributions**, and **Loans** directly from the long-press home screen icon.

---

## 2. Service Worker (`sw.js`) Strategy
- **Pre-caching Shell Assets**: Automatically precaches critical stylesheets, scripts, offline fallback, and icons during the `install` phase.
- **Network-First Navigation with Offline Fallback**:
  - Page navigation requests attempt to reach the server first.
  - When network is unavailable or disconnected, the Service Worker intercepts the request and serves `/offline` (`public/offline.html`).
- **Stale-While-Revalidate for Static Assets**: Static assets in `/static/` are served instantly from cache while an updated copy is fetched in the background.
- **Cache Invalidation**: On `activate`, outdated caches (e.g. `thumari-v0`) are automatically pruned.

---

## 3. Web Push & Notification Lifecycle
- Integrated `push` event listener in the service worker.
- Vibrations (`[100, 50, 100]`), app badge updates (`navigator.setAppBadge`), and custom payload data mapping.
- `notificationclick` handler automatically focuses existing app tabs or opens new windows to the target transaction/meeting URL.

---

## 4. Install UX & In-App Triggers
- Intercepts `beforeinstallprompt` and renders an in-app banner for one-tap installation on Chrome/Android.
- Detects standalone display mode (`window.matchMedia('(display-mode: standalone)')`) to hide redundant install prompts once installed.
