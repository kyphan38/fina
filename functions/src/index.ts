import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

import { dayKey, daysBetween, isReminderWindow } from './time';

initializeApp();
const db = getFirestore();

const EVERY_MINUTES = 15;
const DEFAULT_HOUR = 22;
const DEFAULT_QUIET_DAYS = 2;
const REGION = 'asia-southeast1';

/**
 * Reminder after a long silence.
 *
 * The condition is NOT "nothing logged today" but "N days in a row with no
 * transaction". In real data only 27% of days have a log - a daily reminder
 * would fire ~266 times a year, mostly on days with truly no spending, and
 * would be switched off within two weeks.
 */
export const pushReminders = onSchedule(
  { schedule: `every ${EVERY_MINUTES} minutes`, timeZone: 'UTC', region: REGION },
  async () => {
    const now = new Date();

    const users = await db.collection('users').listDocuments();
    for (const userRef of users) {
      const uid = userRef.id;

      const settings = (await userRef.collection('meta').doc('settings').get()).data() ?? {};
      const hour = Number(settings.reminderHour ?? DEFAULT_HOUR);
      const quietDays = Number(settings.reminderQuietDays ?? DEFAULT_QUIET_DAYS);

      if (!isReminderWindow(now, hour, EVERY_MINUTES)) continue;

      const fcm = (await userRef.collection('meta').doc('fcm').get()).data();
      const token = fcm?.token;
      if (!token) continue;

      // One kind of reminder, once a day.
      const today = dayKey(now);
      const logRef = userRef.collection('meta').doc('pushLog');
      const log = (await logRef.get()).data() ?? {};
      if (log[`quiet:${today}`]) continue;

      const latest = await userRef
        .collection('transactions')
        .orderBy('occurredAt', 'desc')
        .limit(1)
        .get();
      if (latest.empty) continue;

      const quiet = daysBetween(Number(latest.docs[0].data().occurredAt), now.getTime());
      if (quiet < quietDays) continue;

      try {
        // Data-only. With `notification` too, iOS shows TWO notifications.
        await getMessaging().send({
          token,
          data: {
            // iOS already shows the app name on the first line. A 'fina' title would
            // give "fina / from fina / 2 days...", two extra lines.
            title: `${quiet} days since your last entry.`,
            body: '',
            tag: 'fina-quiet',
            url: '/log',
          },
          webpush: { headers: { Urgency: 'normal' } },
        });
        await logRef.set({ [`quiet:${today}`]: Date.now() }, { merge: true });
      } catch (err) {
        // Log the error name only. Never log amounts or notes in production.
        logger.error('push failed', { uid, error: (err as Error).name });
      }
    }
  },
);

/** Cleans old pushLog entries, keeping about 30 days. */
export const trimPushLog = onSchedule(
  { schedule: 'every 24 hours', timeZone: 'UTC', region: REGION },
  async () => {
    const cutoff = Date.now() - 30 * 86_400_000;
    const users = await db.collection('users').listDocuments();
    for (const userRef of users) {
      const ref = userRef.collection('meta').doc('pushLog');
      const data = (await ref.get()).data();
      if (!data) continue;
      const stale = Object.entries(data).filter(([, v]) => Number(v) < cutoff);
      if (stale.length === 0) continue;
      const patch: Record<string, unknown> = {};
      for (const [k] of stale) patch[k] = null;
      await ref.set(patch, { merge: true });
    }
  },
);
