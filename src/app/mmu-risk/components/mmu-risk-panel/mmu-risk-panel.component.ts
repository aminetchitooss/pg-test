import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import type { CellValueChangedEvent } from 'ag-grid-community';
import type {
  EditableMergedRowField,
  MergedRow,
  MmuMultipliers,
} from '../../models/model';
import { MmuRiskStore } from '../../store/mmu-risk.store';
import { MmuRiskControlsComponent } from '../mmu-risk-controls/mmu-risk-controls.component';
import { MmuRiskGridComponent } from '../mmu-risk-grid/mmu-risk-grid.component';
import { MmuRiskStatusBarComponent } from '../mmu-risk-status-bar/mmu-risk-status-bar.component';

const EDITABLE_FIELDS: ReadonlySet<EditableMergedRowField> = new Set([
  'manualAdjustment',
  'targetPosition',
]);

@Component({
  selector: 'app-mmu-risk-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MmuRiskControlsComponent, MmuRiskGridComponent, MmuRiskStatusBarComponent],
  templateUrl: './mmu-risk-panel.component.html',
  styleUrl: './mmu-risk-panel.component.scss',
})
export class MmuRiskPanelComponent {
  protected readonly store = inject(MmuRiskStore);

  readonly changeMmu = output<void>();

  onMultipliersChange(multipliers: MmuMultipliers): void {
    this.store.updateMultipliers(multipliers);
  }

  onSpreadCurvesChange(value: string[]): void {
    this.store.setSpreadCurves(value);
  }

  onCellValueChanged(event: CellValueChangedEvent<MergedRow>): void {
    const tenor = event.data?.tenor;
    const field = event.colDef.field;
    const value = Number(event.newValue);
    if (
      tenor &&
      field &&
      EDITABLE_FIELDS.has(field as EditableMergedRowField) &&
      Number.isFinite(value)
    ) {
      this.store.updatePositionTargetField(tenor, field as EditableMergedRowField, value);
    }
  }
}
