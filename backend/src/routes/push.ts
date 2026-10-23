import { createHash } from 'crypto';
import { Router } from 'express';
import { db } from '../db/client';
import { config } from '../config';
import type { AuthRequest } from '../middleware/requireAuth';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest, NotFound } from '../middleware/errors';
import { intParam } from '../middleware/parse';

const router = Router();

interface SubscribeBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

// A short, stable id of an endpoint so the client can recognise its own
// subscription without the server echoing the full push URL.
export const endpointHash = (endpoint: string): string => createHash('sha256').update(endpoint).digest('hex').slice(0, 16);

// "Safari · iPhone", "Chrome · Windows", … from the user agent captured at subscribe time.
export function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} · ${os}`;
}

// Public VAPID key the browser needs to subscribe. Not secret.
router.get('/vapid', (_req, res) => {
  res.json({ publicKey: config.vapidPublicKey });
});

// The user's subscribed devices (spec 023): label, since, last push, endpoint hash.
router.get('/', asyncRoute<AuthRequest>(async (req, res) => {
  const subs = await db.pushSubscription.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'asc' },
    select: { id: true, endpoint: true, userAgent: true, createdAt: true, lastPushAt: true },
  });
  res.json(subs.map(s => ({
    id: s.id,
    label: deviceLabel(s.userAgent),
    endpointHash: endpointHash(s.endpoint),
    createdAt: s.createdAt,
    lastPushAt: s.lastPushAt,
  })));
}));

router.post('/subscribe', asyncRoute<AuthRequest>(async (req, res) => {
  const { endpoint, keys } = req.body as SubscribeBody;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ message: 'endpoint and keys are required' });
    return;
  }
  const userAgent = (req.headers['user-agent'] ?? '').slice(0, 300) || null;

  // Upsert by endpoint: re-subscribing the same browser updates its keys and owner.
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
  res.status(201).json({ ok: true, endpointHash: endpointHash(endpoint) });
}));

router.post('/unsubscribe', asyncRoute<AuthRequest>(async (req, res) => {
  const { endpoint } = req.body as SubscribeBody;
  if (!endpoint) { res.status(400).json({ message: 'endpoint is required' }); return; }
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
  res.status(204).end();
}));

// Remove one device; it stops receiving pushes at once.
router.delete('/:id', asyncRoute<AuthRequest>(async (req, res) => {
  const id = intParam(req.params.id, 'id', { min: 1 });
  if (id === undefined) throw new BadRequest('id is required');
  const result = await db.pushSubscription.deleteMany({ where: { id, userId: req.userId! } });
  if (result.count === 0) throw new NotFound('device not found');
  res.status(204).end();
}));

export default router;
