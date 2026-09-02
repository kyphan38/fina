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
 * Nhắc khi im lặng quá lâu.
 *
 * Điều kiện KHÔNG phải "chưa log hôm nay" mà là "N ngày liên tiếp không có
 * giao dịch nào". Trên dữ liệu thật, chỉ 27% số ngày có log - nhắc mỗi ngày
 * sẽ kêu ~266 lần/năm, phần lớn vào những ngày người dùng thật sự không
 * tiêu gì, và sẽ bị tắt trong hai tuần.
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

      // Một loại nhắc, một lần mỗi ngày.
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
        // Data-only. Kèm `notification` nữa thì iOS hiện HAI thông báo.
        await getMessaging().send({
          token,
          data: {
            // iOS đã hiện tên app ở dòng đầu. Đặt title là 'fina' nữa thì ra
            // "fina / from fina / 2 days...", thừa hai dòng.
            title: `${quiet} days since your last entry.`,
            body: '',
            tag: 'fina-quiet',
            url: '/log',
          },
          webpush: { headers: { Urgency: 'normal' } },
        });
        await logRef.set({ [`quiet:${today}`]: Date.now() }, { merge: true });
      } catch (err) {
        // Chỉ ghi tên lỗi. Không bao giờ log số tiền hay ghi chú ở production.
        logger.error('push failed', { uid, error: (err as Error).name });
      }
    }
  },
);

/** Dọn pushLog cũ, giữ khoảng 30 ngày. */
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
