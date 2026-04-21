import { describe, expect, it } from 'vitest';
import {
  MapperError,
  exportResponseFromDto,
  exportRequestToDto,
  inputsRequestToDto,
  inputsResponseFromDto,
  inventoryItemFromDto,
  inventoryItemToDto,
  positionTargetFromDto,
  positionTargetToDto,
  riskItemFromDto,
  riskRequestToDto,
  riskResponseFromDto,
  userMappingsFromDto,
  userMappingsRequestToDto,
} from './mapper';
import type {
  InventoryItem,
  PositionTargetItem,
  ReportV4Request,
} from './model';

const REPORT: ReportV4Request = {
  jsonrpc: '2.0',
  id: 'req-1',
  method: 'report_v4',
  params: [{ comment: 'test' }],
};

describe('mapper — fromDto numeric parsing', () => {
  it('parses RiskItem.Value as number', () => {
    expect(riskItemFromDto({ Tenor: '1M', Value: '3.14' })).toEqual({ tenor: '1M', value: 3.14 });
  });

  it('parses "0" explicitly', () => {
    expect(riskItemFromDto({ Tenor: '1M', Value: '0' })).toEqual({ tenor: '1M', value: 0 });
  });

  it('throws on non-numeric string', () => {
    expect(() => riskItemFromDto({ Tenor: '1M', Value: 'abc' })).toThrow(MapperError);
  });

  it('throws on empty string (no silent 0)', () => {
    expect(() => riskItemFromDto({ Tenor: '1M', Value: '' })).toThrow(MapperError);
  });

  it('throws on whitespace-only string', () => {
    expect(() => riskItemFromDto({ Tenor: '1M', Value: '   ' })).toThrow(MapperError);
  });

  it('throws on null/undefined', () => {
    expect(() => riskItemFromDto({ Tenor: '1M', Value: null as unknown as string })).toThrow(
      MapperError,
    );
    expect(() => riskItemFromDto({ Tenor: '1M', Value: undefined as unknown as string })).toThrow(
      MapperError,
    );
  });

  it('parses PositionTargetItem numeric fields', () => {
    const result = positionTargetFromDto({
      Tenor: '6M',
      ReflexPosition: '100',
      ManualAdjustment: '-5',
      AdjustedReflexPosition: '95',
      TargetPosition: '110',
      AdjustedEPosition: '108.5',
    });
    expect(result).toEqual({
      tenor: '6M',
      reflexPosition: 100,
      manualAdjustment: -5,
      adjustedReflexPosition: 95,
      targetPosition: 110,
      adjustedEPosition: 108.5,
    });
  });

  it('PositionTargetItem throws on any empty-string numeric', () => {
    expect(() =>
      positionTargetFromDto({
        Tenor: '6M',
        ReflexPosition: '100',
        ManualAdjustment: '',
        AdjustedReflexPosition: '95',
        TargetPosition: '110',
        AdjustedEPosition: '108',
      }),
    ).toThrow(/ManualAdjustment/);
  });

  it('InventoryItem throws on empty-string numeric', () => {
    expect(() =>
      inventoryItemFromDto({
        RollingFamily: 'EUR-1Y',
        SodPosition: '',
        SodPvPv01: '50',
        NewPosition: '1100',
        NewPv01: '55',
      }),
    ).toThrow(/SodPosition/);
  });
});

describe('mapper — fromDto date parsing', () => {
  it('parses ISO-8601 to Date', () => {
    const r = riskResponseFromDto({
      RequestId: 'r1',
      SpreadCurves: [],
      SnapshotTime: '2026-04-20T10:15:00Z',
      Risk: [],
      Inventory: [],
    });
    expect(r.snapshotTime.toISOString()).toBe('2026-04-20T10:15:00.000Z');
  });

  it('throws on unparseable date', () => {
    expect(() =>
      riskResponseFromDto({
        RequestId: 'r1',
        SpreadCurves: [],
        SnapshotTime: 'not a date',
        Risk: [],
        Inventory: [],
      }),
    ).toThrow(MapperError);
  });

  it('throws on empty date string', () => {
    expect(() =>
      inputsResponseFromDto({
        RequestId: 'r1',
        MmuName: 'EUR',
        LastPublishTime: '',
        LastPublishedBy: 'x',
        Comment: '',
        PositionTargets: [],
      }),
    ).toThrow(/LastPublishTime/);
  });

  it('throws when date field is not a string', () => {
    expect(() =>
      inputsResponseFromDto({
        RequestId: 'r1',
        MmuName: 'EUR',
        LastPublishTime: null as unknown as string,
        LastPublishedBy: 'x',
        Comment: '',
        PositionTargets: [],
      }),
    ).toThrow(/LastPublishTime/);
  });
});

describe('mapper — fromDto boolean parsing', () => {
  it('parses "true" strict', () => {
    expect(exportResponseFromDto({ Success: 'true', Error: '' })).toEqual({
      success: true,
      error: '',
    });
  });

  it('parses "false" strict', () => {
    expect(exportResponseFromDto({ Success: 'false', Error: 'oops' })).toEqual({
      success: false,
      error: 'oops',
    });
  });

  it('throws on non-strict booleans', () => {
    expect(() => exportResponseFromDto({ Success: 'True', Error: '' })).toThrow(MapperError);
    expect(() => exportResponseFromDto({ Success: '1', Error: '' })).toThrow(MapperError);
    expect(() => exportResponseFromDto({ Success: '', Error: '' })).toThrow(MapperError);
  });
});

describe('mapper — userMappings', () => {
  it('maps names and optional spreadCurves', () => {
    expect(
      userMappingsFromDto({ RequestId: 'r', MmuNames: ['A', 'B'], SpreadCurves: ['1M'] }),
    ).toEqual({ mmuNames: ['A', 'B'], spreadCurves: ['1M'] });
  });

  it('passes undefined when SpreadCurves absent', () => {
    expect(userMappingsFromDto({ RequestId: 'r', MmuNames: ['A'] })).toEqual({
      mmuNames: ['A'],
      spreadCurves: undefined,
    });
  });
});

describe('mapper — toDto shaping', () => {
  const sampleTarget: PositionTargetItem = {
    tenor: '1Y',
    reflexPosition: 100,
    manualAdjustment: 2.5,
    adjustedReflexPosition: 102.5,
    targetPosition: 110,
    adjustedEPosition: 108,
  };

  const sampleInventory: InventoryItem = {
    rollingFamily: 'EUR-5Y',
    sodPosition: 200,
    sodPvPv01: 20,
    newPosition: 210,
    newPv01: 21,
  };

  it('positionTargetToDto emits string-typed DTO shape', () => {
    expect(positionTargetToDto(sampleTarget)).toEqual({
      Tenor: '1Y',
      ReflexPosition: '100',
      ManualAdjustment: '2.5',
      AdjustedReflexPosition: '102.5',
      TargetPosition: '110',
      AdjustedEPosition: '108',
    });
  });

  it('inventoryItemToDto emits string-typed DTO shape', () => {
    expect(inventoryItemToDto(sampleInventory)).toEqual({
      RollingFamily: 'EUR-5Y',
      SodPosition: '200',
      SodPvPv01: '20',
      NewPosition: '210',
      NewPv01: '21',
    });
  });

  it('positionTargetToDto throws on NaN', () => {
    expect(() => positionTargetToDto({ ...sampleTarget, reflexPosition: Number.NaN })).toThrow(
      MapperError,
    );
  });

  it('inventoryItemToDto throws on Infinity', () => {
    expect(() =>
      inventoryItemToDto({ ...sampleInventory, sodPvPv01: Number.POSITIVE_INFINITY }),
    ).toThrow(MapperError);
  });

  it('userMappingsRequestToDto passes identity fields', () => {
    expect(userMappingsRequestToDto({ requestId: 'r1', userId: 'alice' })).toEqual({
      RequestId: 'r1',
      UserId: 'alice',
    });
  });

  it('inputsRequestToDto passes identity fields', () => {
    expect(inputsRequestToDto({ requestId: 'r1', mmuName: 'EUR' })).toEqual({
      RequestId: 'r1',
      MmuName: 'EUR',
    });
  });

  it('exportRequestToDto nests inventory + positionTargets as DTOs', () => {
    expect(
      exportRequestToDto({
        requestId: 'r1',
        mmuName: 'EUR',
        userId: 'alice',
        inventory: [sampleInventory],
        positionTargets: [sampleTarget],
      }),
    ).toEqual({
      RequestId: 'r1',
      MmuName: 'EUR',
      UserId: 'alice',
      Inventory: [
        {
          RollingFamily: 'EUR-5Y',
          SodPosition: '200',
          SodPvPv01: '20',
          NewPosition: '210',
          NewPv01: '21',
        },
      ],
      PositionTargets: [
        {
          Tenor: '1Y',
          ReflexPosition: '100',
          ManualAdjustment: '2.5',
          AdjustedReflexPosition: '102.5',
          TargetPosition: '110',
          AdjustedEPosition: '108',
        },
      ],
    });
  });

  it('riskRequestToDto stringifies ReportV4Request with clean round-trip', () => {
    const dto = riskRequestToDto({
      requestId: 'r1',
      mmuName: 'EUR_DESK',
      spreadCurves: ['1M', '6M'],
      reportV4Request: REPORT,
    });
    expect(dto).toMatchObject({
      RequestId: 'r1',
      MmuName: 'EUR_DESK',
      SpreadCurves: ['1M', '6M'],
    });
    expect(dto.ReportV4Request).toBe(JSON.stringify(REPORT));
    expect(JSON.parse(dto.ReportV4Request)).toEqual(REPORT);
  });

  it('riskRequestToDto throws on circular ReportV4Request', () => {
    const bad = { jsonrpc: '2.0', id: 'x', method: 'report_v4', params: [] as unknown[] };
    (bad.params as unknown[]).push(bad);
    expect(() =>
      riskRequestToDto({
        requestId: 'r1',
        mmuName: 'EUR',
        spreadCurves: [],
        reportV4Request: bad as unknown as ReportV4Request,
      }),
    ).toThrow(MapperError);
  });
});
