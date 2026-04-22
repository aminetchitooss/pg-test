import type { MmuInputsResult, MmuRiskResult } from './model';

/**
 * HTTP response → domain boundary. The only thing the backend sends that
 * isn't domain-shaped as-is is DateTime (serialized as ISO string). These
 * helpers parse the two date fields we care about; every other field passes
 * through identity.
 */

export class ParseError extends Error {
  constructor(message: string) {
    super(`[mmu-risk parsers] ${message}`);
    this.name = 'ParseError';
  }
}

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ParseError(`expected ISO-8601 date for "${field}", got ${JSON.stringify(value)}`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ParseError(`expected ISO-8601 date for "${field}", got ${JSON.stringify(value)}`);
  }
  return d;
}

type WithStringDate<T, K extends keyof T> = Omit<T, K> & { [P in K]: string };

export type RawMmuRiskResponse = WithStringDate<MmuRiskResult, 'snapshotTime'>;
export type RawMmuInputsResponse = WithStringDate<MmuInputsResult, 'lastPublishTime'>;

export function parseRiskResponse(raw: RawMmuRiskResponse): MmuRiskResult {
  return { ...raw, snapshotTime: parseDate(raw.snapshotTime, 'MmuRiskResponse.snapshotTime') };
}

export function parseInputsResponse(raw: RawMmuInputsResponse): MmuInputsResult {
  return {
    ...raw,
    lastPublishTime: parseDate(raw.lastPublishTime, 'MmuInputsResponse.lastPublishTime'),
  };
}
