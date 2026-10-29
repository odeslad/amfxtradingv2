import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '../db/client';
import { asyncRoute } from '../middleware/asyncRoute';
import { BadRequest } from '../middleware/errors';
import {
  bodyRecord, nonEmptyString, finiteNumber, oneOf, optionalOneOf, optionalString, optionalInteger, optionalBoolean,
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

interface PresetInput {
  id?: number;
  name: string;
  brokers: MirrorItem[];
}

interface DisplayInput {
  pnlMode: (typeof PNL_MODES)[number];
  trendlineColor?: string;
  trendlineStyle?: (typeof TRENDLINE_STYLES)[number];
  trendlineWidth?: number;
  rectLabels?: boolean;
  showSpread?: boolean;
}

interface Visibility {
  hiddenBrokers: string[];
  hiddenSymbols: Record<string, string[]>;
}

interface DisplayRow {
  pnlMode: string;
  trendlineColor: string;
  trendlineStyle: string;
  trendlineWidth: number;
  rectLabels: boolean;
  showSpread: boolean;
  hiddenBrokers: string[];
  hiddenSymbols: Prisma.JsonValue;
}

function parseMirror(value: unknown, prefix: string): MirrorItem[] {
  if (!Array.isArray(value)) throw new BadRequest(`${prefix} must be an array`);
  return value.map((item, i) => {
    const row = bodyRecord(item);
    const key = `${prefix}[${i}]`;
    if (typeof row.enabled !== 'boolean') throw new BadRequest(`${key}.enabled must be a boolean`);
    return {
      broker: nonEmptyString(row.broker, `${key}.broker`),
      enabled: row.enabled,
      lotsMode: oneOf(row.lotsMode, `${key}.lotsMode`, LOTS_MODES),
      lots: finiteNumber(row.lots, `${key}.lots`, { positive: true }),
    };
  });
}

const PRESET_NAME_MAX = 40;

export function parsePresets(value: unknown): PresetInput[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequest('presets must be a non-empty array');
  const names = new Set<string>();
  return value.map((item, i) => {
    const row = bodyRecord(item);
    const key = `presets[${i}]`;
    const name = nonEmptyString(row.name, `${key}.name`).trim();
    if (name.length === 0 || name.length > PRESET_NAME_MAX) throw new BadRequest(`${key}.name must be 1-${PRESET_NAME_MAX} characters`);
    if (names.has(name)) throw new BadRequest(`${key}.name is repeated`);
    names.add(name);
    const id = row.id === undefined ? undefined : optionalInteger(row.id, `${key}.id`, { min: 1 });
    return { id, name, brokers: parseMirror(row.brokers, `${key}.brokers`) };
  });
}

export function parseDisplay(value: unknown): DisplayInput {
  const row = bodyRecord(value);
  return {
    pnlMode: oneOf(row.pnlMode, 'display.pnlMode', PNL_MODES),
    trendlineColor: optionalString(row.trendlineColor, 'display.trendlineColor'),
    trendlineStyle: optionalOneOf(row.trendlineStyle, 'display.trendlineStyle', TRENDLINE_STYLES),
    trendlineWidth: optionalInteger(row.trendlineWidth, 'display.trendlineWidth', { min: 1 }),
    rectLabels: optionalBoolean(row.rectLabels, 'display.rectLabels'),
    showSpread: optionalBoolean(row.showSpread, 'display.showSpread'),
  };
}

function parseStringList(value: unknown, key: string, upper = false): string[] {
  if (!Array.isArray(value)) throw new BadRequest(`${key} must be an array`);
  const items = value.map((item, i) => {
    const text = nonEmptyString(item, `${key}[${i}]`).trim();
    return upper ? text.toUpperCase() : text;
  });
  return Array.from(new Set(items));
}

function parseVisibility(value: unknown): Visibility {
  const row = bodyRecord(value);
  const symbolsRow = bodyRecord(row.hiddenSymbols ?? {});
  const hiddenSymbols: Record<string, string[]> = {};
  for (const [broker, symbols] of Object.entries(symbolsRow)) {
    const list = parseStringList(symbols, `visibility.hiddenSymbols.${broker}`, true);
    if (list.length > 0) hiddenSymbols[broker] = list;
  }
  return {
    hiddenBrokers: parseStringList(row.hiddenBrokers ?? [], 'visibility.hiddenBrokers'),
    hiddenSymbols,
  };
}

function readHiddenSymbols(value: Prisma.JsonValue | undefined): Record<string, string[]> {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [broker, symbols] of Object.entries(value)) {
    if (Array.isArray(symbols)) out[broker] = symbols.filter((s): s is string => typeof s === 'string');
  }
  return out;
}

interface PresetRow {
  id: number;
  name: string;
  brokers: Prisma.JsonValue;
}

function toResponse(presets: PresetRow[], display: DisplayRow | null) {
  return {
    presets: presets.map(({ id, name, brokers }) => ({ id, name, brokers })),
    display: {
      pnlMode: display?.pnlMode ?? 'net',
      trendlineColor: display?.trendlineColor ?? '#8c8c8c',
      trendlineStyle: display?.trendlineStyle ?? 'dashed',
      trendlineWidth: display?.trendlineWidth ?? 1,
      rectLabels: display?.rectLabels ?? true,
      showSpread: display?.showSpread ?? false,
    },
    visibility: {
      hiddenBrokers: display?.hiddenBrokers ?? [],
      hiddenSymbols: readHiddenSymbols(display?.hiddenSymbols),
    },
  };
}

function loadSettings() {
  return Promise.all([
    db.mirrorPreset.findMany({ orderBy: { position: 'asc' } }),
    db.settingsDisplay.findFirst({ where: { key: 'global' } }),
  ]);
}

const router = Router();

router.get('/', asyncRoute(async (_req, res) => {
  const [presets, display] = await loadSettings();
  res.json(toResponse(presets, display));
}));

router.put('/', asyncRoute(async (req, res) => {
  // Parse everything before the first write so a bad item leaves nothing half-saved.
  const body = bodyRecord(req.body);
  const presets = body.presets !== undefined ? parsePresets(body.presets) : undefined;
  const display = body.display !== undefined ? parseDisplay(body.display) : undefined;
  const visibility = body.visibility !== undefined ? parseVisibility(body.visibility) : undefined;

  const ops: Promise<unknown>[] = [];

  if (presets !== undefined) {
    // Replace the whole list: names are unique, so free them all before writing the new ones.
    const keepIds = presets.flatMap(p => (p.id === undefined ? [] : [p.id]));
    ops.push(db.$transaction(async tx => {
      await tx.mirrorPreset.deleteMany({ where: { id: { notIn: keepIds } } });
      for (const id of keepIds) await tx.mirrorPreset.update({ where: { id }, data: { name: `__renaming_${id}` } });
      for (const [position, p] of presets.entries()) {
        const data = { name: p.name, position, brokers: p.brokers as unknown as Prisma.InputJsonValue };
        if (p.id !== undefined) await tx.mirrorPreset.update({ where: { id: p.id }, data });
        else await tx.mirrorPreset.create({ data });
      }
    }));
  }

  if (display !== undefined || visibility !== undefined) {
    const displayFields = display === undefined ? {} : {
      pnlMode: display.pnlMode,
      ...(display.trendlineColor !== undefined ? { trendlineColor: display.trendlineColor } : {}),
      ...(display.trendlineStyle !== undefined ? { trendlineStyle: display.trendlineStyle } : {}),
      ...(display.trendlineWidth !== undefined ? { trendlineWidth: display.trendlineWidth } : {}),
      ...(display.rectLabels !== undefined ? { rectLabels: display.rectLabels } : {}),
      ...(display.showSpread !== undefined ? { showSpread: display.showSpread } : {}),
    };
    const visibilityFields = visibility === undefined ? {} : {
      hiddenBrokers: visibility.hiddenBrokers,
      hiddenSymbols: visibility.hiddenSymbols,
    };
    ops.push(
      db.settingsDisplay.upsert({
        where: { key: 'global' },
        update: { ...displayFields, ...visibilityFields },
        create: {
          key: 'global',
          pnlMode: display?.pnlMode ?? 'net',
          trendlineColor: display?.trendlineColor ?? '#8c8c8c',
          trendlineStyle: display?.trendlineStyle ?? 'dashed',
          trendlineWidth: display?.trendlineWidth ?? 1,
          rectLabels: display?.rectLabels ?? true,
          showSpread: display?.showSpread ?? false,
          ...visibilityFields,
        },
      })
    );
  }

  await Promise.all(ops);

  const [updatedPresets, updatedDisplay] = await loadSettings();
  res.json(toResponse(updatedPresets, updatedDisplay));
}));

export default router;
