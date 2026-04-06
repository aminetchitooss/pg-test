import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { RiskPositionStatus } from '../../models/risk-position.model';

@Component({
  selector: 'app-risk-position-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status(); as s) {
      <footer class="status-bar" role="status" aria-live="polite" aria-label="Risk position status">
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
        <span class="status-item"
          ><strong>Comment:</strong> {{ s.comment }}</span
        >
        <span class="status-warning" role="alert">Some tenors could not be matched with saved data</span>
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
export class RiskPositionStatusBarComponent {
  readonly status = input<RiskPositionStatus | null>(null);
}
