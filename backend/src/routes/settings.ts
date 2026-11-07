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
export const SETUP_LEVEL_KEYS = ['ECC', 'EMA', 'EVL', 'MHL'] as const;
type SetupLevelKey = (typeof SETUP_LEVEL_KEYS)[number];
// Percent values the Fibonacci tool may draw (spec 037); 0 and 100 are the anchors and always stay on.
export const FIB_LEVEL_CATALOGUE = [0, 23.6, 38.2, 50, 61.8, 78.6, 100, 127.2, 161.8, 200, 261.8] as const;
const FIB_LEVEL_ANCHORS = [0, 100];
export const DEFAULT_FIB_LEVELS = [0, 23.6, 38.2, 50, 61.8, 78.6, 100];

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
  setupLevels?: SetupLevelKey[];
  fibLevels?: number[];
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
  setupLevels: string[];
  fibLevels: number[];
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

// Known level keys only, deduplicated and in canonical order; an empty list hides the panel.
function parseSetupLevels(value: unknown): SetupLevelKey[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequest('display.setupLevels must be an array');
  const isKey = (item: unknown): item is SetupLevelKey => typeof item === 'string' && (SETUP_LEVEL_KEYS as readonly string[]).includes(item);
  value.forEach((item, i) => {
    if (!isKey(item)) throw new BadRequest(`display.setupLevels[${i}] must be one of ${SETUP_LEVEL_KEYS.join(', ')}`);
  });
  return SETUP_LEVEL_KEYS.filter(key => value.includes(key));
}

// Catalogue values only, deduplicated and in canonical order; the anchors are forced in.
function parseFibLevels(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new BadRequest('display.fibLevels must be an array');
  const catalogue: readonly number[] = FIB_LEVEL_CATALOGUE;
  value.forEach((item, i) => {
    if (typeof item !== 'number' || !catalogue.includes(item)) {
      throw new BadRequest(`display.fibLevels[${i}] must be one of ${catalogue.join(', ')}`);
    }
  });
  return catalogue.filter(level => FIB_LEVEL_ANCHORS.includes(level) || value.includes(level));
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
    setupLevels: parseSetupLevels(row.setupLevels),
    fibLevels: parseFibLevels(row.fibLevels),
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
      setupLevels: display?.setupLevels ?? [...SETUP_LEVEL_KEYS],
      fibLevels: display?.fibLevels ?? DEFAULT_FIB_LEVELS,
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
      ...(display.setupLevels !== undefined ? { setupLevels: display.setupLevels } : {}),
      ...(display.fibLevels !== undefined ? { fibLevels: display.fibLevels } : {}),
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
          setupLevels: display?.setupLevels ?? [...SETUP_LEVEL_KEYS],
          fibLevels: display?.fibLevels ?? DEFAULT_FIB_LEVELS,
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
