import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import type { RiskPositionMultipliers } from '../../models/risk-position.model';

@Component({
  selector: 'app-risk-position-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule],
  templateUrl: './risk-position-controls.component.html',
  styleUrl: './risk-position-controls.component.scss',
})
export class RiskPositionControlsComponent {
  readonly multipliers = input.required<RiskPositionMultipliers>();
  readonly spreadCurves = input.required<string>();
  readonly isLoading = input(false);

  readonly multipliersChange = output<RiskPositionMultipliers>();
  readonly spreadCurvesChange = output<string>();
  readonly refreshRisk = output<void>();
  readonly refreshInputs = output<void>();
  readonly exportPositions = output<void>();

  onMultiplierChange(field: keyof RiskPositionMultipliers, value: string): void {
    const num = Number(value);
    if (!isNaN(num)) {
      this.multipliersChange.emit({ ...this.multipliers(), [field]: num });
    }
  }

  onSpreadCurvesChange(value: string): void {
    this.spreadCurvesChange.emit(value);
  }
}
