import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { db } from '../src/db/client';

const DATA_DIR = path.resolve(__dirname, '../../data');
const BROKERS = ['darwinex', 'solidary', 'solidary demo'];

interface DataConfig {
  assets: Record<string, { enabled: boolean }>;
}

function loadConfig(): DataConfig {
  const configPath = path.join(DATA_DIR, 'config.json');
  if (!fs.existsSync(configPath)) throw new Error(`Missing ${configPath}`);
  return JSON.parse(fs.readFileSync(configPath, 'utf8')) as DataConfig;
}
const BATCH_SIZE = 5000;

const TF_MINUTES: Record<string, number> = {
  M5: 5,
  M15: 15,
  H1: 60,
  H4: 240,
  D1: 1440,
};

interface M1Candle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface AggCandle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

function floorToTf(date: Date, minutes: number): Date {
  const ms = minutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

function parseM1Line(line: string): M1Candle | null {
  const parts = line.trim().split(';');
  if (parts.length < 5) return null;

  const [datePart, timePart] = parts[0].split(' ');
  if (!datePart || !timePart) return null;

  const year = datePart.slice(0, 4);
  const month = datePart.slice(4, 6);
  const day = datePart.slice(6, 8);
  const hh = timePart.slice(0, 2);
  const mm = timePart.slice(2, 4);
  const ss = timePart.slice(4, 6);

  const time = new Date(`${year}-${month}-${day}T${hh}:${mm}:${ss}Z`);
  if (isNaN(time.getTime())) return null;

  const open = parseFloat(parts[1]);
  const high = parseFloat(parts[2]);
  const low = parseFloat(parts[3]);
  const close = parseFloat(parts[4]);

  if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;

  return { time, open, high, low, close };
}

function aggregateToTf(candles: M1Candle[], tfMinutes: number): AggCandle[] {
  const buckets = new Map<number, AggCandle>();

  for (const c of candles) {
    const bucketTime = floorToTf(c.time, tfMinutes);
    const key = bucketTime.getTime();

    if (!buckets.has(key)) {
      buckets.set(key, { time: bucketTime, open: c.open, high: c.high, low: c.low, close: c.close });
    } else {
      const b = buckets.get(key)!;
      if (c.high > b.high) b.high = c.high;
      if (c.low < b.low) b.low = c.low;
      b.close = c.close;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.time.getTime() - b.time.getTime());
}

function readM1FromZip(zipPath: string): M1Candle[] {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'histdata-'));

  try {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path "${zipPath}" -DestinationPath "${tmpDir}" -Force`,
    ]);

    const files = fs.readdirSync(tmpDir);
    const csvFile = files.find((f) => f.endsWith('.csv') || f.endsWith('.txt'));
    if (!csvFile) throw new Error(`No CSV found in ${zipPath}`);

    const content = fs.readFileSync(path.join(tmpDir, csvFile), 'utf8');
    const candles: M1Candle[] = [];

    for (const line of content.split('\n')) {
      const c = parseM1Line(line);
      if (c) candles.push(c);
    }

    return candles;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function insertBatch(
  records: { broker: string; symbol: string; timeframe: string; time: Date; open: number; high: number; low: number; close: number }[],
) {
  await db.candle.createMany({ data: records, skipDuplicates: true });
}

async function processSymbol(symbol: string, zipFiles: string[]) {
  console.log(`\n[${symbol}] Leyendo ${zipFiles.length} zips...`);

  const allM1: M1Candle[] = [];
  for (const zipPath of zipFiles) {
    process.stdout.write(`  ${path.basename(zipPath)}... `);
    const candles = readM1FromZip(zipPath);
    allM1.push(...candles);
    console.log(`${candles.length} velas M1`);
  }

  allM1.sort((a, b) => a.time.getTime() - b.time.getTime());
  console.log(`  Total M1: ${allM1.length} velas`);

  for (const [tfName, tfMinutes] of Object.entries(TF_MINUTES)) {
    console.log(`  Agregando ${tfName}...`);
    const aggregated = aggregateToTf(allM1, tfMinutes);
    console.log(`  ${aggregated.length} velas ${tfName} → insertando para ${BROKERS.length} brokers...`);

    for (const broker of BROKERS) {
      let inserted = 0;
      for (let i = 0; i < aggregated.length; i += BATCH_SIZE) {
        const batch = aggregated.slice(i, i + BATCH_SIZE).map((c) => ({
          broker,
          symbol,
          timeframe: tfName,
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        await insertBatch(batch);
        inserted += batch.length;
        process.stdout.write(`\r    [${broker}] ${tfName}: ${inserted}/${aggregated.length}   `);
      }
      console.log();
    }
  }
}

async function main() {
  const symbolDirs = fs.readdirSync(DATA_DIR).filter((d) => {
    return fs.statSync(path.join(DATA_DIR, d)).isDirectory();
  });

  const config = loadConfig();
  const enabledDirs = symbolDirs.filter((d) => config.assets[d]?.enabled === true);

  console.log(`Símbolos habilitados: ${enabledDirs.join(', ')}`);

  for (const symbol of enabledDirs) {
    const dir = path.join(DATA_DIR, symbol);
    const zipFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => path.join(dir, f))
      .sort();

    if (zipFiles.length === 0) {
      console.log(`[${symbol}] Sin zips, saltando.`);
      continue;
    }

    await processSymbol(symbol, zipFiles);
  }

  await db.$disconnect();
  console.log('\nImportación completada.');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
