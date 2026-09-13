# Android APK & Trusted Web Activity (TWA) Guide for Thumari

This guide explains how Thumari provides a downloadable Android APK directly from the website and builds signed APKs via GitHub Actions.

---

## 1. How the APK Works (Trusted Web Activity)
A **Trusted Web Activity (TWA)** wraps the Thumari Progressive Web App into a native Android `.apk` package. It uses the modern Android Custom Tabs / Chromium engine installed on the user's phone, giving:
- Native app launcher icon on the Android Home Screen and App Drawer.
- Full-screen immersion with **no URL bar** or browser controls.
- Push notifications delivered through Android notification channels.
- Shared storage, cookies, and login session with the mobile browser.

---

## 2. Digital Asset Links Verification
For Android to hide the URL address bar, the app verifies that the website and APK are owned by the same entity using **Digital Asset Links**:
1. Server serves `/.well-known/assetlinks.json`.
2. Android OS queries this endpoint upon app launch and checks if the SHA-256 fingerprint matches the APK's signing certificate.
3. Once verified, the URL bar disappears completely.

Configure your production certificate fingerprint in `.env`:
```env
ANDROID_CERT_FINGERPRINTS=14:6D:E9:7D:0F:52:AB:E6:EC:65:C4:B8:BC:21:AE:B8:70:50:C0:79:02:4F:10:04:6D:4D:09:9B:0F:7B:6C:A5
ANDROID_PACKAGE_NAME=app.thumari.twa
```

---

## 3. Website APK Download Portal (`/download`)
The `/download` route serves a user-friendly download center providing:
- One-click direct APK download (`/static/downloads/thumari.apk` or custom release URL).
- Alternative "Install PWA" trigger for iOS/Desktop users.
- Step-by-step instructions for allowing installation from unknown sources on Android.

---

## 4. Automated CI/CD Release via GitHub Actions
The `.github/workflows/android-release.yml` workflow automatically builds and signs the APK whenever a git tag like `v1.0.0` is pushed:
```bash
git tag v1.0.0
git push origin v1.0.0
```
The workflow outputs both a direct `app-release-signed.apk` and a Google Play `app-release-bundle.aab` published under GitHub Releases.
