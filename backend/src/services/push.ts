import webpush from 'web-push';
import { db } from '../db/client';
import { config } from '../config';

// Web Push delivery. Configured once from VAPID keys; when keys are absent the
// service is a no-op so the rest of the app keeps working in dev.

const enabled = Boolean(config.vapidPublicKey && config.vapidPrivateKey);

if (enabled) {
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
} else {
  console.warn('[PUSH] VAPID keys not set — push notifications disabled');
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export function isPushEnabled(): boolean {
  return enabled;
}

// Send a notification to every subscription of a user. Subscriptions that the
// push service rejects as gone (404/410) are pruned automatically.
export async function sendToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!enabled) return;

  const subs = await db.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body,
      );
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.error(`[PUSH] send failed (user ${userId}, sub ${sub.id}):`, status ?? err);
      }
    }
  }));
}
