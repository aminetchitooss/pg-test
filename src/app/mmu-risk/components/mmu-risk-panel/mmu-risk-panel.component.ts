import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import type { CellValueChangedEvent } from 'ag-grid-community';
import type { MmuMultipliers, OverrideSource } from '../../models/mmu-risk.model';
import { MmuRiskStore } from '../../store/mmu-risk.store';
import { MmuRiskControlsComponent } from '../mmu-risk-controls/mmu-risk-controls.component';
import { MmuRiskGridComponent } from '../mmu-risk-grid/mmu-risk-grid.component';
import { MmuRiskStatusBarComponent } from '../mmu-risk-status-bar/mmu-risk-status-bar.component';

@Component({
  selector: 'app-mmu-risk-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MmuRiskControlsComponent, MmuRiskGridComponent, MmuRiskStatusBarComponent],
  templateUrl: './mmu-risk-panel.component.html',
  styleUrl: './mmu-risk-panel.component.scss',
})
export class MmuRiskPanelComponent {
  protected readonly store = inject(MmuRiskStore);
  private readonly grid = viewChild(MmuRiskGridComponent);

  exportCsv(): void {
    console.log('[mmu-risk] Export Positions clicked');
    this.grid()?.exportCsv();
  }

  onMultipliersChange(multipliers: MmuMultipliers): void {
    this.store.updateMultipliers(multipliers);
  }

  onSpreadCurvesChange(value: string): void {
    this.store.updateSpreadCurves(value);
  }

  onOverrideChange(source: OverrideSource): void {
    this.store.setOverride(source);
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    const tenor = event.data?.['qualifiedTenor'];
    if (typeof tenor === 'string') {
      this.store.updateRow(tenor, { ...event.data });
    }
  }
}
