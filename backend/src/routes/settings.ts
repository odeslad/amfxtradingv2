import { Router } from 'express';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import {
  bodyRecord, nonEmptyString, finiteNumber, oneOf, optionalOneOf, optionalString, optionalInteger,
} from '../middleware/parse';

const LOTS_MODES = ['fixed', 'risk_pct'] as const;
const PNL_MODES = ['net', 'gross', 'pips', 'pct'] as const;
const TRENDLINE_STYLES = ['solid', 'dashed', 'dotted'] as const;

interface MirrorItem {
  broker: string;
  enabled: boolean;
  lotsMode: (typeof LOTS_MODES)[number];
  lots: number;
}

interface DisplayInput {
  pnlMode: (typeof PNL_MODES)[number];
  trendlineColor?: string;
  trendlineStyle?: (typeof TRENDLINE_STYLES)[number];
  trendlineWidth?: number;
}

function parseMirror(value: unknown): MirrorItem[] {
  if (!Array.isArray(value)) throw new BadRequest('mirror must be an array');
  return value.map((item, i) => {
    const row = bodyRecord(item);
    const key = `mirror[${i}]`;
    if (typeof row.enabled !== 'boolean') throw new BadRequest(`${key}.enabled must be a boolean`);
    return {
      broker: nonEmptyString(row.broker, `${key}.broker`),
      enabled: row.enabled,
      lotsMode: oneOf(row.lotsMode, `${key}.lotsMode`, LOTS_MODES),
      lots: finiteNumber(row.lots, `${key}.lots`, { positive: true }),
    };
  });
}

function parseDisplay(value: unknown): DisplayInput {
  const row = bodyRecord(value);
  return {
    pnlMode: oneOf(row.pnlMode, 'display.pnlMode', PNL_MODES),
    trendlineColor: optionalString(row.trendlineColor, 'display.trendlineColor'),
    trendlineStyle: optionalOneOf(row.trendlineStyle, 'display.trendlineStyle', TRENDLINE_STYLES),
    trendlineWidth: optionalInteger(row.trendlineWidth, 'display.trendlineWidth', { min: 1 }),
  };
}

const router = Router();

router.get('/', asyncRoute(async (_req, res) => {
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
}));

router.put('/', asyncRoute(async (req, res) => {
  // Parse everything before the first write so a bad item leaves nothing half-saved.
  const body = bodyRecord(req.body);
  const mirror = body.mirror !== undefined ? parseMirror(body.mirror) : undefined;
  const display = body.display !== undefined ? parseDisplay(body.display) : undefined;

  const ops: Promise<unknown>[] = [];

  if (mirror !== undefined) {
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
}));

export default router;
