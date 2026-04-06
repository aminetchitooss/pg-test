import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { RiskPositionApiService } from '../../services/risk-position-api.service';
import type {
  RiskPositionApiResponse,
  RiskPositionDialogData,
  RiskPositionMultipliers,
  RiskPositionRow,
  RiskViewType,
} from '../../models/risk-position.model';
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
  templateUrl: './risk-position-dialog.component.html',
  styleUrl: './risk-position-dialog.component.scss',
})
export class RiskPositionDialogComponent implements OnInit {
  private readonly apiService = inject(RiskPositionApiService);
  private readonly dialogData = inject<RiskPositionDialogData>(MAT_DIALOG_DATA);
  private readonly grid = viewChild(RiskPositionGridComponent);

  readonly viewType: RiskViewType = this.dialogData.viewType;

  readonly apiResponse = signal<RiskPositionApiResponse | null>(null);
  readonly isLoading = signal(false);
  readonly multipliers = signal<RiskPositionMultipliers>({
    reflexPositionMultiplier: 1,
    manualAdjustmentMultiplier: 1,
    targetPositionMultiplier: 1,
  });
  readonly spreadCurves = signal('1M,6M,12M,OIS');

  readonly columns = computed(() => this.apiResponse()?.columns ?? []);
  readonly rows = signal<RiskPositionRow[]>([]);
  readonly status = computed(() => this.apiResponse()?.status ?? null);

  ngOnInit(): void {
    this.loadData();
  }

  onMultipliersChange(multipliers: RiskPositionMultipliers): void {
    this.multipliers.set(multipliers);
  }

  onRefreshRisk(): void {
    this.loadData();
  }

  onRefreshInputs(): void {
    this.isLoading.set(true);
    this.apiService.refreshInputs(this.viewType).subscribe((response) => {
      this.apiResponse.set(response);
      this.rows.set(response.rows);
      this.isLoading.set(false);
    });
  }

  onExportPositions(): void {
    this.grid()?.exportCsv();
  }

  onCellValueChanged(event: CellValueChangedEvent): void {
    this.rows.update((currentRows) =>
      currentRows.map((row) =>
        row.qualifiedTenor === event.data?.['qualifiedTenor'] ? { ...event.data } : row,
      ),
    );
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.apiService.fetchRiskPositions(this.viewType).subscribe((response) => {
      this.apiResponse.set(response);
      this.rows.set(response.rows);
      this.isLoading.set(false);
    });
  }
}
