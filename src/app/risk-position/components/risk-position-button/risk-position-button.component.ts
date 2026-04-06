import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { RiskPositionDialogComponent } from '../risk-position-dialog/risk-position-dialog.component';
import type { RiskViewType } from '../../models/risk-position.model';

@Component({
  selector: 'app-risk-position-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule],
  template: `
    <div class="button-group">
      <button mat-raised-button color="primary" (click)="openDialog('risk-position')">
        Open Risk Position
      </button>
      <button mat-raised-button color="accent" (click)="openDialog('pnl-attribution')">
        Open P&amp;L Attribution
      </button>
    </div>
  `,
  styles: `
    .button-group {
      display: flex;
      gap: 12px;
    }
  `,
})
export class RiskPositionButtonComponent {
  private readonly dialog = inject(MatDialog);

  openDialog(viewType: RiskViewType): void {
    this.dialog.open(RiskPositionDialogComponent, {
      width: '95vw',
      maxWidth: '1600px',
      height: '85vh',
      panelClass: 'risk-position-dialog-panel',
      data: { viewType },
    });
  }
}
