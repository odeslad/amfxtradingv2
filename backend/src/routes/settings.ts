import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (_req, res) => {
  const [mirror, display] = await Promise.all([
    db.settingsMirror.findMany({ orderBy: { broker: 'asc' } }),
    db.settingsDisplay.findFirst({ where: { key: 'global' } }),
  ]);
  res.json({ mirror, display: { pnlMode: display?.pnlMode ?? 'net' } });
});

router.put('/', async (req, res) => {
  const { mirror, display } = req.body as {
    mirror?: { broker: string; enabled: boolean; lotsMode: string; lots: number }[];
    display?: { pnlMode: string };
  };

  const ops: Promise<unknown>[] = [];

  if (mirror !== undefined) {
    if (!Array.isArray(mirror)) {
      res.status(400).json({ error: 'mirror must be an array' });
      return;
    }
    ops.push(...mirror.map(({ broker, enabled, lotsMode, lots }) =>
      db.settingsMirror.upsert({
        where: { broker },
        update: { enabled, lotsMode, lots },
        create: { broker, enabled, lotsMode, lots },
      })
    ));
  }

  if (display !== undefined) {
    ops.push(
      db.settingsDisplay.upsert({
        where: { key: 'global' },
        update: { pnlMode: display.pnlMode },
        create: { key: 'global', pnlMode: display.pnlMode },
      })
    );
  }

  await Promise.all(ops);

  const [updatedMirror, updatedDisplay] = await Promise.all([
    db.settingsMirror.findMany({ orderBy: { broker: 'asc' } }),
    db.settingsDisplay.findFirst({ where: { key: 'global' } }),
  ]);

  res.json({ mirror: updatedMirror, display: { pnlMode: updatedDisplay?.pnlMode ?? 'net' } });
});

export default router;
