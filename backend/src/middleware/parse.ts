import { BadRequest } from './errors';

type Query = Record<string, unknown>;

interface IntOptions {
  min?: number;
  max?: number;
  default?: number;
  // Cap at max instead of rejecting — keeps today's `Math.min(limit, cap)` behaviour.
  clamp?: boolean;
}

const INT_RE = /^-?\d+$/;

// Query values arrive as string | string[] | undefined; a repeated key is a 400.
export function singleQuery(query: Query, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequest(`${key} must be a single value`);
  return value;
}

export function requiredQuery(query: Query, key: string): string {
  const value = singleQuery(query, key);
  if (!value) throw new BadRequest(`${key} is required`);
  return value;
}

export function intParam(raw: string | undefined, key: string, opts: IntOptions = {}): number | undefined {
  if (raw === undefined || raw === '') return opts.default;
  if (!INT_RE.test(raw)) throw new BadRequest(`${key} must be an integer`);
  const value = Number(raw);
  if (opts.min !== undefined && value < opts.min) throw new BadRequest(`${key} must be >= ${opts.min}`);
  if (opts.max !== undefined && value > opts.max) {
    if (opts.clamp) return opts.max;
    throw new BadRequest(`${key} must be <= ${opts.max}`);
  }
  return value;
}

// Epoch seconds (what the chart sends for before/after/from/to).
export function epochParam(raw: string | undefined, key: string): Date | undefined {
  const seconds = intParam(raw, key, { min: 1 });
  return seconds === undefined ? undefined : new Date(seconds * 1000);
}

export function dateParam(raw: string | undefined, key: string): Date | undefined {
  if (raw === undefined || raw === '') return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new BadRequest(`${key} must be a valid date`);
  return date;
}

export function oneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new BadRequest(`${key} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function optionalOneOf<T extends string>(value: unknown, key: string, allowed: readonly T[]): T | undefined {
  return value === undefined ? undefined : oneOf(value, key, allowed);
}

export function finiteNumber(value: unknown, key: string, opts: { positive?: boolean; min?: number } = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequest(`${key} must be a number`);
  if (opts.positive && value <= 0) throw new BadRequest(`${key} must be > 0`);
  if (opts.min !== undefined && value < opts.min) throw new BadRequest(`${key} must be >= ${opts.min}`);
  return value;
}

export function optionalFiniteNumber(value: unknown, key: string, opts?: { positive?: boolean; min?: number }): number | undefined {
  return value === undefined ? undefined : finiteNumber(value, key, opts);
}

export function integer(value: unknown, key: string, opts: { min?: number } = {}): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new BadRequest(`${key} must be an integer`);
  if (opts.min !== undefined && value < opts.min) throw new BadRequest(`${key} must be >= ${opts.min}`);
  return value;
}

export function optionalInteger(value: unknown, key: string, opts?: { min?: number }): number | undefined {
  return value === undefined ? undefined : integer(value, key, opts);
}

export function nonEmptyString(value: unknown, key: string): string {
  if (typeof value !== 'string' || value === '') throw new BadRequest(`${key} is required`);
  return value;
}

export function optionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new BadRequest(`${key} must be a string`);
  return value;
}

export function optionalBoolean(value: unknown, key: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new BadRequest(`${key} must be a boolean`);
  return value;
}

// Bodies are `any` from express.json(); narrow to a record once per route.
export function bodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequest('body must be an object');
  return body as Record<string, unknown>;
}
