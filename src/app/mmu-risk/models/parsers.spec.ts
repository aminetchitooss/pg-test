import { describe, expect, it } from 'vitest';
import { ParseError, parseInputsResponse, parseRiskResponse } from './parsers';

describe('parsers — date parsing', () => {
  it('parses ISO-8601 snapshotTime into Date', () => {
    const out = parseRiskResponse({
      spreadCurves: [],
      snapshotTime: '2026-04-22T10:15:00Z',
      risk: [],
      inventory: [],
    });
    expect(out.snapshotTime).toBeInstanceOf(Date);
    expect(out.snapshotTime.toISOString()).toBe('2026-04-22T10:15:00.000Z');
  });

  it('throws on unparseable snapshotTime', () => {
    expect(() =>
      parseRiskResponse({
        spreadCurves: [],
        snapshotTime: 'not a date',
        risk: [],
        inventory: [],
      }),
    ).toThrow(ParseError);
  });

  it('throws when snapshotTime is empty or non-string', () => {
    expect(() =>
      parseRiskResponse({
        spreadCurves: [],
        snapshotTime: '',
        risk: [],
        inventory: [],
      }),
    ).toThrow(ParseError);
    expect(() =>
      parseRiskResponse({
        spreadCurves: [],
        snapshotTime: null as unknown as string,
        risk: [],
        inventory: [],
      }),
    ).toThrow(ParseError);
  });

  it('parses lastPublishTime in inputs response', () => {
    const out = parseInputsResponse({
      mmuName: 'EUR',
      lastPublishTime: '2026-04-21T18:02:00Z',
      lastPublishedBy: 'jdoe',
      comment: '',
      positionTargets: [],
    });
    expect(out.lastPublishTime.toISOString()).toBe('2026-04-21T18:02:00.000Z');
  });

  it('passes through everything else identity', () => {
    const out = parseRiskResponse({
      spreadCurves: ['1M', '6M'],
      snapshotTime: '2026-04-22T10:15:00Z',
      risk: [{ tenor: '1M', value: 3.14 }],
      inventory: [
        {
          rollingFamily: 'EUR-1Y',
          sodPosition: 100,
          sodPvPv01: 10,
          newPosition: 100,
          newPv01: 10,
        },
      ],
    });
    expect(out.spreadCurves).toEqual(['1M', '6M']);
    expect(out.risk).toEqual([{ tenor: '1M', value: 3.14 }]);
    expect(out.inventory[0]).toMatchObject({ rollingFamily: 'EUR-1Y', sodPosition: 100 });
  });
});
