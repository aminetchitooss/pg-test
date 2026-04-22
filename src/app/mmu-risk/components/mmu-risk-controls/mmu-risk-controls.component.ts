import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import type { MmuMultipliers } from '../../models/model';

@Component({
  selector: 'app-mmu-risk-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule],
  templateUrl: './mmu-risk-controls.component.html',
  styleUrl: './mmu-risk-controls.component.scss',
})
export class MmuRiskControlsComponent {
  readonly multipliers = input.required<MmuMultipliers>();
  readonly spreadCurves = input.required<string[]>();
  readonly spreadCurvesEditable = input(true);
  readonly riskLoading = input(false);
  readonly inputsLoading = input(false);
  readonly exportLoading = input(false);

  readonly multipliersChange = output<MmuMultipliers>();
  readonly spreadCurvesChange = output<string[]>();
  readonly refreshRisk = output<void>();
  readonly refreshInputs = output<void>();
  readonly exportPositions = output<void>();

  protected readonly spreadCurvesText = computed(() => this.spreadCurves().join(','));

  onMultiplierChange(field: keyof MmuMultipliers, value: number | null | string): void {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num)) {
      this.multipliersChange.emit({ ...this.multipliers(), [field]: num });
    }
  }

  onSpreadCurvesInputChange(value: string): void {
    const curves = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    this.spreadCurvesChange.emit(curves);
  }
}
