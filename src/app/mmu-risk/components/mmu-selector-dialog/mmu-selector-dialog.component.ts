import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MmuRiskStore } from '../../store/mmu-risk.store';

@Component({
  selector: 'app-mmu-selector-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
    MatFormFieldModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Select MMU</h2>
    <mat-dialog-content>
      @if (store.userMappingsLoading()) {
        <p role="status" aria-live="polite">Loading MMU list…</p>
      } @else if (store.userMappingsError(); as err) {
        <p role="alert" class="error">Failed to load MMU list: {{ err }}</p>
        <button mat-stroked-button type="button" (click)="retry()">Retry</button>
      } @else if (names().length === 0) {
        <p role="status">No MMUs available for this user.</p>
      } @else {
        <mat-form-field appearance="fill" class="full-width">
          <mat-label>MMU</mat-label>
          <mat-select
            [value]="selected()"
            (valueChange)="selected.set($event)"
            aria-label="MMU selection"
          >
            @for (name of names(); track name) {
              <mat-option [value]="name">{{ name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()" aria-label="Cancel MMU selection">
        Cancel
      </button>
      <button
        mat-raised-button
        color="primary"
        type="button"
        [disabled]="!canProceed()"
        (click)="proceed()"
        aria-label="Proceed with selected MMU"
      >
        Proceed
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .full-width { width: 100%; min-width: 260px; }
    .error { color: var(--app-error-color, #d32f2f); }
  `,
})
export class MmuSelectorDialogComponent implements OnInit {
  protected readonly store = inject(MmuRiskStore);
  private readonly dialogRef = inject(MatDialogRef<MmuSelectorDialogComponent, string | null>);

  protected readonly selected = signal<string | null>(null);
  protected readonly names = computed(() => this.store.availableMmuNames());
  protected readonly canProceed = computed(() => !!this.selected());

  ngOnInit(): void {
    this.store.loadUserMappings();
  }

  retry(): void {
    this.store.loadUserMappings();
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  proceed(): void {
    const name = this.selected();
    if (!name) return;
    this.dialogRef.close(name);
  }
}
