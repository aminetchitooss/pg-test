import type { RiskPositionMultipliers, RiskPositionRow } from '../models/risk-position.model';

export function computeAdjustedReflexPosition(
  row: RiskPositionRow,
  multipliers: RiskPositionMultipliers,
): number {
  const reflex = (row['reflexPosition'] as number) ?? 0;
  const manual = (row['manualAdjustment'] as number) ?? 0;
  return reflex * multipliers.reflexPositionMultiplier + manual * multipliers.manualAdjustmentMultiplier;
}

export function computeAdjustedEPosition(
  row: RiskPositionRow,
  multipliers: RiskPositionMultipliers,
): number {
  const target = (row['targetPosition'] as number) ?? 0;
  const adjusted = computeAdjustedReflexPosition(row, multipliers);
  return adjusted - target * multipliers.targetPositionMultiplier;
}
