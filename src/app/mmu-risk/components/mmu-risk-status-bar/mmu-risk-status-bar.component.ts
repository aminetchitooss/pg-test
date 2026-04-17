import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { MmuStatus } from '../../models/mmu-risk.model';

@Component({
  selector: 'app-mmu-risk-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status(); as s) {
      <footer class="status-bar" role="status" aria-live="polite" aria-label="MMU risk status">
        <span class="status-item"><strong>MMU:</strong> {{ s.mmuDirection }}</span>
        <span class="status-item"
          ><strong>Current snapshot time:</strong> {{ s.snapshotTime }}</span
        >
        <span class="status-item"
          ><strong>Last publish time:</strong> {{ s.lastPublishTime }}</span
        >
        <span class="status-item"
          ><strong>Last published by:</strong> {{ s.lastPublishedBy }}</span
        >
        <span class="status-item"><strong>Comment:</strong> {{ s.comment }}</span>
        @for (warning of s.warnings; track warning) {
          <span class="status-warning" role="alert">{{ warning }}</span>
        }
      </footer>
    }
  `,
  styles: `
    .status-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 6px 12px;
      background: var(--app-bg-muted, #e8e8e8);
      border-top: 1px solid var(--app-border-muted, #b0b0b0);
      font-size: 0.75rem;
      color: var(--app-text-color, #333);
      flex-wrap: wrap;
    }

    .status-item {
      white-space: nowrap;
    }

    .status-warning {
      margin-left: auto;
      color: var(--app-error-color, #d32f2f);
      font-weight: 500;
    }
  `,
})
export class MmuRiskStatusBarComponent {
  readonly status = input<MmuStatus | null>(null);
}
