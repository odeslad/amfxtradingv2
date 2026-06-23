import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/', async (_req, res) => {
  const [mirror, display] = await Promise.all([
    db.settingsMirror.findMany({ orderBy: { broker: 'asc' } }),
    db.settingsDisplay.findFirst({ where: { key: 'global' } }),
  ]);
  res.json({
    mirror,
    display: {
      pnlMode: display?.pnlMode ?? 'net',
      trendlineColor: display?.trendlineColor ?? '#8c8c8c',
      trendlineStyle: display?.trendlineStyle ?? 'dashed',
      trendlineWidth: display?.trendlineWidth ?? 1,
    },
  });
});

router.put('/', async (req, res) => {
  const { mirror, display } = req.body as {
    mirror?: { broker: string; enabled: boolean; lotsMode: string; lots: number }[];
    display?: { pnlMode: string; trendlineColor?: string; trendlineStyle?: string; trendlineWidth?: number };
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
        update: {
          pnlMode: display.pnlMode,
          ...(display.trendlineColor !== undefined ? { trendlineColor: display.trendlineColor } : {}),
          ...(display.trendlineStyle !== undefined ? { trendlineStyle: display.trendlineStyle } : {}),
          ...(display.trendlineWidth !== undefined ? { trendlineWidth: display.trendlineWidth } : {}),
        },
        create: {
          key: 'global',
          pnlMode: display.pnlMode,
          trendlineColor: display.trendlineColor ?? '#8c8c8c',
          trendlineStyle: display.trendlineStyle ?? 'dashed',
          trendlineWidth: display.trendlineWidth ?? 1,
        },
      })
    );
  }

  await Promise.all(ops);

  const [updatedMirror, updatedDisplay] = await Promise.all([
    db.settingsMirror.findMany({ orderBy: { broker: 'asc' } }),
    db.settingsDisplay.findFirst({ where: { key: 'global' } }),
  ]);

  res.json({
    mirror: updatedMirror,
    display: {
      pnlMode: updatedDisplay?.pnlMode ?? 'net',
      trendlineColor: updatedDisplay?.trendlineColor ?? '#8c8c8c',
      trendlineStyle: updatedDisplay?.trendlineStyle ?? 'dashed',
      trendlineWidth: updatedDisplay?.trendlineWidth ?? 1,
    },
  });
});

export default router;
