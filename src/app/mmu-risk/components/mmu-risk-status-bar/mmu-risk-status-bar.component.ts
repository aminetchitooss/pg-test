import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-mmu-risk-status-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <footer class="status-bar" role="status" aria-live="polite" aria-label="MMU risk status">
      <span class="status-item"><strong>MMU:</strong> {{ mmuName() || '—' }}</span>
      <span class="status-item"
        ><strong>Snapshot:</strong> {{ snapshotLabel() }}</span
      >
      <span class="status-item"
        ><strong>Last publish:</strong> {{ publishLabel() }}</span
      >
      <span class="status-item"
        ><strong>Last published by:</strong> {{ lastPublishedBy() || '—' }}</span
      >
      @if (comment()) {
        <span class="status-item"><strong>Comment:</strong> {{ comment() }}</span>
      }
    </footer>
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
  `,
})
export class MmuRiskStatusBarComponent {
  readonly mmuName = input<string | null>(null);
  readonly snapshotTime = input<Date | null>(null);
  readonly lastPublishTime = input<Date | null>(null);
  readonly lastPublishedBy = input<string>('');
  readonly comment = input<string>('');

  protected readonly snapshotLabel = computed(() => formatDate(this.snapshotTime()));
  protected readonly publishLabel = computed(() => formatDate(this.lastPublishTime()));
}

function formatDate(d: Date | null): string {
  if (!d) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
