import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { MmuMultipliers, OverrideSource } from '../../models/mmu-risk.model';

@Component({
  selector: 'app-mmu-risk-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatSlideToggleModule],
  templateUrl: './mmu-risk-controls.component.html',
  styleUrl: './mmu-risk-controls.component.scss',
})
export class MmuRiskControlsComponent {
  readonly multipliers = input.required<MmuMultipliers>();
  readonly spreadCurves = input.required<string>();
  readonly override = input.required<OverrideSource>();
  readonly inputsIncludeRiskColumns = input.required<boolean>();
  readonly riskLoading = input(false);
  readonly configLoading = input(false);

  readonly multipliersChange = output<MmuMultipliers>();
  readonly spreadCurvesChange = output<string>();
  readonly overrideChange = output<OverrideSource>();
  readonly inputsIncludeRiskColumnsChange = output<boolean>();
  readonly refreshRisk = output<void>();
  readonly refreshInputs = output<void>();
  readonly exportPositions = output<void>();

  onMultiplierChange(field: keyof MmuMultipliers, value: string): void {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      this.multipliersChange.emit({ ...this.multipliers(), [field]: num });
    }
  }

  onSpreadCurvesChange(value: string): void {
    this.spreadCurvesChange.emit(value);
  }

  onOverrideToggle(checked: boolean): void {
    this.overrideChange.emit(checked ? 'inputs' : 'risk');
  }
}
