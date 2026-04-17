import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { useShortcut } from '../../../shared/shortcut/use-shortcut';
import { MmuRiskStore } from '../../store/mmu-risk.store';
import { MmuRiskPanelComponent } from '../mmu-risk-panel/mmu-risk-panel.component';

@Component({
  selector: 'app-mmu-risk-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MmuRiskPanelComponent],
  providers: [MmuRiskStore],
  templateUrl: './mmu-risk-page.component.html',
  styleUrl: './mmu-risk-page.component.scss',
})
export class MmuRiskPageComponent {
  private readonly store = inject(MmuRiskStore);

  protected readonly isOpen = signal(false);
  private initialized = false;

  constructor() {
    useShortcut('ctrl+a', () => this.toggle());
    useShortcut('escape', () => {
      if (this.isOpen()) {
        this.toggle();
        return;
      }
      return false; // pass through when panel is closed
    });
  }

  toggle(): void {
    const next = !this.isOpen();
    console.log('[mmu-risk]', next ? 'Open MMU Risk clicked' : 'Close MMU Risk clicked');
    this.isOpen.set(next);
    if (next && !this.initialized) {
      this.store.init();
      this.initialized = true;
    }
  }
}
