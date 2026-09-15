# Thumari — Group Savings & Loan Management (PWA & Android APK)

**Thumari** is a modern, high-performance financial management platform engineered for savings groups, SACCOs, Chamas, and Welfare associations. It provides seamless member tracking, contribution accounting, loan amortization, meeting management, automated fines, and real-time push notifications.

Thumari is built with **Vite, React 19, TypeScript, and `vite-plugin-pwa`**, engineered from the ground up as an installable **Progressive Web App (PWA)** and a downloadable **Android APK (Trusted Web Activity - TWA)**.


---

## 🌟 Key Features

### 1. 👥 Member Management
- Member profiling and unique numbering (`M-0001`, `M-0002`).
- National ID / NIDA tracking, contact info, and status lifecycle (`active`, `dormant`, `exited`).
- Real-time total accumulated savings computation per member.

### 2. 💰 Contributions & Share Capital
- Flexible contribution categories: **Monthly Savings**, **Welfare Fund**, **Share Capital**, and **Emergency Fund**.
- Support for multiple payment methods (M-Pesa, Cash, Bank Transfer).
- Printable official contribution receipts with transaction reference codes.

### 3. 📈 Loan Products & Amortization
- Customizable loan products with configurable interest rates, repayment periods, and savings multipliers.
- **Flat Interest** and **Reducing Balance (Amortized Level Payments)** mathematical engines.
- Step-by-step workflow: Application ➔ Guarantor Assignment ➔ Officer Review/Approval ➔ Disbursement ➔ Repayments.
- Penalty-first payment waterfall allocation and automated overdue penalty calculations.

### 4. 📅 Meetings & Attendance Fines
- Meeting scheduler with agenda and venue details.
- Attendance register with automated absence penalty fine generation.
- Fines ledger with real-time status tracking.

### 5. 🔔 Push & In-App Notification System
- **Web Push Protocol (VAPID)** delivering background notifications to web browsers and installed Android APKs.
- Automated notification triggers for received contributions, loan approvals/disbursements, upcoming dues, and meeting notices.
- Per-user notification preference toggles.
- Administrative broadcast announcement composer.

### 6. 📱 PWA & Downloadable Android APK (TWA)
- Full PWA capabilities: Responsive 192x192, 512x512, and maskable icons, dynamic Web Manifest, and Service Worker caching with offline fallback.
- **Android APK (TWA)**: Full-screen native experience without browser URL bar via Digital Asset Links (`/.well-known/assetlinks.json`).
- Dedicated `/download` portal on the web app for direct APK downloads.
- Automated GitHub Actions release pipeline (`.github/workflows/android-release.yml`) for building signed APKs and Google Play AABs.

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js 20+ (Node.js 22/26 recommended)
- npm 10+

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/dafirmcoder/Thumari.git
cd Thumari

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Generate Web Push VAPID keys
npm run vapid:generate
# (Copy the generated keys into your .env file)

# 5. Seed the database with initial admin user and standard products
npm run db:seed

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Deployment

Thumari runs as a persistent Fastify server and should be deployed as a Node web service, not as a serverless function. A Render blueprint is included in `render.yaml`; create a Render service from this repository and enter the `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PUBLIC_BASE_URL` values when prompted. The blueprint mounts persistent storage at `/var/data` for the SQLite database.

**Default Admin Credentials:**
- **Email:** `admin@thumari.local`
- **Password:** `Admin@12345`

---

## 🛠️ NPM Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite development server with Hot Module Replacement |
| `npm run build` | Compiles TypeScript and builds production PWA into `dist/` |
| `npm run preview` | Previews the compiled production bundle locally |
| `npm test` | Runs the automated Vitest test suite |
| `npm run typecheck` | Validates TypeScript types across the codebase |


---

## 📚 Documentation & Guides

- [PWA Improvements & Audit Guide](docs/PWA-IMPROVEMENTS.md)
- [Android APK & TWA Packaging Guide](docs/ANDROID-APK.md)
- [Web Push & Notification System Guide](docs/NOTIFICATIONS.md)

---

## 📄 License
Private repository — All rights reserved.