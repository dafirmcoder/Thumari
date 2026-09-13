# Web Push & In-App Notification System for Thumari

Thumari features a unified notification pipeline that powers both in-app alerts and native push notifications across web browsers and installed Android APKs.

---

## 1. Architecture Overview
- **Standard**: W3C Web Push Protocol (RFC 8030) + VAPID (Voluntary Application Server Identification).
- **Backend Driver**: `web-push` Node.js library.
- **Client Handler**: Service Worker (`public/sw.js`) handling the `push` and `notificationclick` events.
- **Persistence**:
  - `push_subscriptions`: Stores device endpoints, encryption keys (`p256dh`, `auth`), and failure counts.
  - `notification_preferences`: Per-user toggles for optional notification event categories.
  - `notifications`: History log and user inbox.

---

## 2. Notification Event Catalogue

| Event Key | Label | Audience | Configurable? | Priority |
|---|---|---|---|---|
| `contribution.recorded` | Contribution Received | Member | Yes | Normal |
| `contribution.reminder` | Monthly Contribution Due | Member | Yes | Normal |
| `loan.application.received` | New Loan Application | Officers | Yes | High |
| `loan.approved` | Loan Approved | Member | No (Mandatory) | High |
| `loan.rejected` | Loan Rejected | Member | No (Mandatory) | High |
| `loan.disbursed` | Loan Disbursed | Member | No (Mandatory) | High |
| `loan.installment.due` | Installment Due Reminder | Member | Yes | Normal |
| `loan.installment.overdue` | Installment Arrears Notice | Member | No (Mandatory) | High |
| `loan.repayment.received` | Repayment Receipt | Member | Yes | Normal |
| `meeting.scheduled` | Meeting Scheduled Notice | All Members | Yes | Normal |
| `meeting.reminder` | Meeting Reminder | All Members | Yes | Normal |
| `fine.issued` | Absence / Penalty Fine | Member | No (Mandatory) | High |
| `system.announcement` | General Broadcast | All Members | Yes | Normal |

---

## 3. Generating VAPID Keys
To generate fresh VAPID keys for your production environment:
```bash
npm run vapid:generate
```
Add the output to `.env`:
```env
VAPID_PUBLIC_KEY=BH...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@thumari.app
```

---

## 4. Subscribing a Device
Users can navigate to **Alerts (`/notifications`)** and click **"Enable Push on This Device"**. The client browser requests permission, retrieves the push endpoint, and registers it with `/api/push/subscribe`.
