import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (_req, res) => {
  const mirror = await db.settingsMirror.findMany({ orderBy: { broker: 'asc' } });
  res.json({ mirror });
});

router.put('/', async (req, res) => {
  const { mirror } = req.body as {
    mirror?: { broker: string; enabled: boolean; lotsMode: string; lots: number }[];
  };

  if (mirror !== undefined) {
    if (!Array.isArray(mirror)) {
      res.status(400).json({ error: 'mirror must be an array' });
      return;
    }
    await Promise.all(
      mirror.map(({ broker, enabled, lotsMode, lots }) =>
        db.settingsMirror.upsert({
          where: { broker },
          update: { enabled, lotsMode, lots },
          create: { broker, enabled, lotsMode, lots },
        })
      )
    );
  }

  const updated = await db.settingsMirror.findMany({ orderBy: { broker: 'asc' } });
  res.json({ mirror: updated });
});

export default router;
