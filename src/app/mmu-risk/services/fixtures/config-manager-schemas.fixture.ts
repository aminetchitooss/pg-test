/**
 * Schemas cycled on each fetchInputs() call so the user can exercise the
 * merge/dedup logic. Two pools are exposed — one pool stays disjoint from
 * Risk's columns, the other intentionally overlaps on reflexPosition /
 * adjustedReflexPosition so the override toggle has something to act on.
 *
 * To keep the merged grid at a stable 7 columns (no layout shift) both pools
 * are sized so the count of config-unique fields per schema is 4:
 *   - WITHOUT pool: tenor + 4 unique fields = 5 fields per schema
 *   - WITH pool:    tenor + 2 overlap + 4 unique = 7 fields per schema
 *     (the 2 overlap fields dedup against Risk, so 4 unique remain post-merge)
 *
 * Each Refresh Inputs rotates which unique fields are present without ever
 * changing the total merged column count.
 *
 * Field names must exist in the CONFIG_MANAGER_COLUMN_CATALOG.
 */

export const SCHEMAS_WITHOUT_RISK_OVERLAP: readonly string[][] = [
  ['qualifiedTenor', 'manualAdjustment', 'targetPosition', 'adjustedEPosition', 'cvaExposure'],
  ['qualifiedTenor', 'manualAdjustment', 'targetPosition', 'cvaExposure', 'hedgeRatio'],
  ['qualifiedTenor', 'manualAdjustment', 'adjustedEPosition', 'cvaExposure', 'hedgeRatio'],
  ['qualifiedTenor', 'targetPosition', 'adjustedEPosition', 'cvaExposure', 'hedgeRatio'],
];

export const SCHEMAS_WITH_RISK_OVERLAP: readonly string[][] = [
  [
    'qualifiedTenor',
    'reflexPosition',
    'adjustedReflexPosition',
    'manualAdjustment',
    'targetPosition',
    'adjustedEPosition',
    'cvaExposure',
  ],
  [
    'qualifiedTenor',
    'reflexPosition',
    'adjustedReflexPosition',
    'manualAdjustment',
    'targetPosition',
    'cvaExposure',
    'hedgeRatio',
  ],
  [
    'qualifiedTenor',
    'reflexPosition',
    'adjustedReflexPosition',
    'manualAdjustment',
    'adjustedEPosition',
    'cvaExposure',
    'hedgeRatio',
  ],
  [
    'qualifiedTenor',
    'reflexPosition',
    'adjustedReflexPosition',
    'targetPosition',
    'adjustedEPosition',
    'cvaExposure',
    'hedgeRatio',
  ],
];
