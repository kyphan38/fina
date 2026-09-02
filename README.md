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
| 1 - Foundation & Auth | done, live at fina.kyphan38.com | 2026-09-02 |
| 2 - Buckets & Quick Log | done | 2026-09-02 |
| 3 - Summary & Cycle | done, awaiting a real cold-start reading | 2026-09-02 |
| 4 - History, Edit & Import | done | 2026-09-02 |
| 5 - Overspend & Cover | done | 2026-09-02 |
| 6 - PWA & Reminder | code done, needs Blaze to deploy | 2026-09-02 |
| 7 - Insights | next | |

### Reminders

A push at 22:00 after two quiet days - two, not one, because only 43 of 159
days carry an entry and a daily nudge would fire around 266 times a year,
mostly on days with genuinely nothing to log.

Setting it up, once:

1. Firebase Console -> upgrade to **Blaze**. Cloud Functions needs it. Both
   scheduled jobs sit inside Cloud Scheduler's free tier.
2. Console -> Project settings -> Cloud Messaging -> **Web Push
   certificates** -> generate. Put the key in `.env.local` and Vercel as
   `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. `cd functions && npm install && cd .. && firebase deploy --only functions`
4. On the iPhone: open the site **in Safari**, Share -> Add to Home Screen.
   Open it from that icon, then Settings -> Turn on. iOS only delivers web
   push to an installed app, so `/settings` says "not installed" in a normal
   browser tab - that is correct, not a bug.

**To stop paying.** Delete the two functions and drop back to Spark:

```bash
firebase functions:delete pushReminders trimPushLog
```

The app keeps working; you lose lock-screen reminders.

### Stage 2 notes

- The first cold-start metric fired on the user's first keypad tap, so it
  measured how long someone took to decide to type - one reading came out at
  28 seconds. It now fires two animation frames after the keypad paints.
- Seed baselines are integer literals. `4.1 * 1_000_000` is
  `4099999.9999999995`, `firestore.rules` requires an int, and a rejected
  document takes the whole batch with it.

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
- `package.json` pins `jose` to 5.10.0. jose 6 is ESM-only and `jwks-rsa` (via
  firebase-admin) still `require()`s it, so every server route 500s on Vercel
  without the override. Dev and `next build` both pass regardless - the failure
  only shows when the serverless bundle loads the external module at runtime.
- The Vercel project was created before any code was pushed, so its framework
  preset defaulted to "Other" and it served `public/`. `vercel.json` pins it.
