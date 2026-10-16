import { ChangeDetectionStrategy, Component, effect, inject, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIcon } from '@angular/material/icon';
import { GridServerFilterService } from './grid-server-filter.service';

/**
 * The input for a grid's server-side filter:
 *
 *   @if (serverFilterService.enabled()) {
 *     <grid-server-filter-bar (applied)="refetch()" />
 *   }
 *
 * Applies on Enter or the Apply button — never while typing, because every apply
 * is a new query. `applied` fires only when the text really changed (including
 * Clear), so the host can persist the setting and refetch.
 */
@Component({
  selector: 'grid-server-filter-bar',
  imports: [ReactiveFormsModule, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-icon class="sf-icon" aria-hidden="true">cloud_sync</mat-icon>
    <label class="sf-label" for="grid-server-filter-input">Server filter</label>
    <input
      id="grid-server-filter-input"
      class="sf-input"
      type="text"
      autocomplete="off"
      spellcheck="false"
      placeholder="SQL condition sent with the query — e.g. trade.id IN (10,20) AND desk = 'FX'"
      [formControl]="draft"
      (keydown.enter)="apply()"
    />
    <button type="button" class="sf-btn sf-apply" [disabled]="!isDirty()" (click)="apply()">
      Apply
    </button>
    <button
      type="button"
      class="sf-btn"
      [disabled]="!service.text() && !draft.value"
      (click)="clear()"
    >
      Clear
    </button>
    @if (service.error(); as error) {
      <span class="sf-error" role="alert">{{ error }}</span>
    } @else if (service.text()) {
      <span class="sf-state" role="status">Applied — results come from the server</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 10px;
      background: #eff5fe;
      border-bottom: 1px solid #c9d9ee;
      font-size: 12px;
      color: #1d3f66;
    }
    .sf-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
    .sf-label {
      font-weight: 600;
      white-space: nowrap;
    }
    .sf-input {
      flex: 1;
      min-width: 160px;
      height: 26px;
      padding: 0 8px;
      border: 1px solid #8aa4c4;
      border-radius: 4px;
      font: 12px/1 ui-monospace, monospace;
      background: #fff;
      color: #1a1a1a;
    }
    .sf-input:focus-visible,
    .sf-btn:focus-visible {
      outline: 2px solid #1d5b8f;
      outline-offset: 1px;
    }
    .sf-btn {
      height: 26px;
      padding: 0 10px;
      border: 1px solid #1d5b8f;
      border-radius: 4px;
      background: #fff;
      color: #1d5b8f;
      cursor: pointer;
    }
    .sf-apply {
      background: #1d5b8f;
      color: #fff;
    }
    .sf-btn:disabled {
      opacity: 0.55;
      cursor: default;
    }
    .sf-error {
      color: #b3261e;
      font-weight: 600;
      white-space: nowrap;
    }
    .sf-state {
      color: #1b5e20;
      white-space: nowrap;
    }
  `,
})
export class GridServerFilterBarComponent {
  protected service = inject(GridServerFilterService);

  readonly applied = output<string>();

  protected draft = new FormControl('', { nonNullable: true });

  constructor() {
    // Follow the service: saved settings can arrive after the first render.
    effect(() => this.draft.setValue(this.service.text(), { emitEvent: false }));
  }

  protected isDirty(): boolean {
    return this.draft.value.trim() !== this.service.text();
  }

  protected apply(): void {
    if (this.service.apply(this.draft.value)) this.applied.emit(this.service.text());
  }

  protected clear(): void {
    this.draft.setValue('');
    if (this.service.clear()) this.applied.emit('');
  }
}
