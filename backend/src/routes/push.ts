import { Router } from 'express';
import { db } from '../db/client';
import { config } from '../config';
import type { AuthRequest } from '../middleware/requireAuth';

const router = Router();

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

// Public VAPID key the browser needs to subscribe. Not secret.
router.get('/vapid', (_req, res) => {
  res.json({ publicKey: config.vapidPublicKey });
});

router.post('/subscribe', async (req: AuthRequest, res) => {
  const { endpoint, keys } = req.body as SubscribeBody;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ message: 'endpoint and keys are required' });
    return;
  }

  // Upsert by endpoint: re-subscribing the same browser updates its keys and owner.
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json({ ok: true });
});

router.post('/unsubscribe', async (req: AuthRequest, res) => {
  const { endpoint } = req.body as SubscribeBody;
  if (!endpoint) { res.status(400).json({ message: 'endpoint is required' }); return; }
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
  res.status(204).end();
});

export default router;
