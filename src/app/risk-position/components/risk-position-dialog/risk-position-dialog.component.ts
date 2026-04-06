import { ChangeDetectionStrategy, Component, inject, OnInit, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import type { RiskPositionDialogData, RiskPositionMultipliers } from '../../models/risk-position.model';
import { RiskPositionStore } from '../../store/risk-position.store';
import { RiskPositionControlsComponent } from '../risk-position-controls/risk-position-controls.component';
import { RiskPositionGridComponent } from '../risk-position-grid/risk-position-grid.component';
import { RiskPositionStatusBarComponent } from '../risk-position-status-bar/risk-position-status-bar.component';
import type { CellValueChangedEvent } from 'ag-grid-community';

@Component({
  selector: 'app-risk-position-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    RiskPositionControlsComponent,
    RiskPositionGridComponent,
    RiskPositionStatusBarComponent,
  ],
  providers: [RiskPositionStore],
  templateUrl: './risk-position-dialog.component.html',
  styleUrl: './risk-position-dialog.component.scss',
})
export class RiskPositionDialogComponent implements OnInit {
  private readonly dialogData = inject<RiskPositionDialogData>(MAT_DIALOG_DATA);
  private readonly grid = viewChild(RiskPositionGridComponent);

  protected readonly store = inject(RiskPositionStore);
  readonly viewType = this.dialogData.viewType;

  ngOnInit(): void {
    this.store.init(this.viewType);
  }

  onMultipliersChange(multipliers: RiskPositionMultipliers): void {
    this.store.updateMultipliers(multipliers);
  }

  onRefreshRisk(): void {
    this.store.loadData();
  }

  onRefreshInputs(): void {
    this.store.refreshInputs();
  }

  onExportPositions(): void {
    this.grid()?.exportCsv();
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    this.store.updateRow(event.data?.['qualifiedTenor'], { ...event.data });
  }
}
