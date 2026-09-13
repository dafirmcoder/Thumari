# Thumari Android App (Trusted Web Activity - TWA)

This directory contains the configuration and build instructions for packaging the Thumari PWA into a native Android APK and Google Play Store-ready Android App Bundle (AAB).

## 1. Overview of TWA
A **Trusted Web Activity (TWA)** wraps your web app in a dedicated Chrome/Chromium Android container without any browser address bar or navigation buttons. It shares cookies, cache, Web Push subscriptions, and service worker offline states seamlessly with the browser.

## 2. Prerequisites for Local Builds
- Node.js 20+
- Java Development Kit (JDK 17 or 21)
- Android SDK & command-line tools
- Bubblewrap CLI:
  ```bash
  npm install -g @bubblewrap/cli
  ```

## 3. Generating a Release Keystore
Generate a secure Android signing key:
```bash
keytool -genkey -v -keystore android.keystore -alias thumari -keyalg RSA -keysize 2048 -validity 10000
```

## 4. Extracting the SHA-256 Fingerprint
Extract the certificate fingerprint:
```bash
keytool -list -v -keystore android.keystore -alias thumari
```
Look for `Certificate fingerprints:` -> `SHA256: 14:6D:E9:...`

Add this fingerprint to your `.env` file on the production server:
```env
ANDROID_CERT_FINGERPRINTS=14:6D:E9:7D:0F:...
ANDROID_PACKAGE_NAME=app.thumari.twa
```
This enables the server to serve `/.well-known/assetlinks.json` so Android verifies ownership and eliminates the URL address bar.

## 5. Building the APK with Bubblewrap
```bash
bubblewrap build --manifest=twa-manifest.json
```
Output files:
- `app-release-signed.apk` -> Direct downloadable APK for users on the website
- `app-release-bundle.aab` -> Upload directly to Google Play Console
