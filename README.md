# fina

Personal money log. Next.js (App Router) + Firebase + Vercel.
Replaces `Budget.numbers` + iOS Shortcuts.

Plan and design decisions: [`roadmap/ROADMAP.md`](roadmap/ROADMAP.md).

## Facts

| | |
|---|---|
| Firebase project | `kyphan38-fina-app`, database `(default)` |
| Allowlist | one email, `ALLOWED_USER_EMAIL` |
| Session | httpOnly cookie `fina_session`, 14 days |
| Cycle | starts on the **25th**. A 25 Aug expense belongs to cycle `2026-09` |
| Money | stored as integer VND. Typed and shown in thousands (`155.36` = 155.360đ) |
| Fonts | system stack only, no web font |

## Setup

```bash
npm install
cp .env.example .env.local   # fill in from Firebase Console
npm run dev
```

Credentials come from Firebase Console → Project settings:
**General → Your apps** for the `NEXT_PUBLIC_*` values, **Service accounts →
Generate new private key** for the three `FIREBASE_ADMIN_*` values.

## Commands

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
firebase deploy --only firestore:rules,firestore:indexes
```

## Stage log

| Stage | Status | Date |
|---|---|---|
| 1 - Foundation & Auth | done | 2026-09-02 |
| 2 - Buckets & Quick Log | next | |

### Stage 1 notes

- `create-next-app` ships Geist from Google Fonts. Removed - a downloaded font is
  a font you wait for, and cold-start speed is the whole point of this app.
- Zoom is locked (`maximumScale: 1`). Double-tap zoom on a numeric keypad only
  ever causes mis-taps.
- Next's dev badge sits exactly on top of the `Log` tab, so `devIndicators` is off.
- Firestore rules reject a non-integer `amountVnd` at the database layer, not just
  in the UI.
- The allowlist is checked twice: once when exchanging the ID token, and again on
  every server-side read of the session cookie.
