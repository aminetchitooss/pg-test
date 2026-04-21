import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { useShortcut } from '../../../shared/shortcut/use-shortcut';
import { MmuRiskStore } from '../../store/mmu-risk.store';
import { MmuRiskPanelComponent } from '../mmu-risk-panel/mmu-risk-panel.component';
import { MmuSelectorDialogComponent } from '../mmu-selector-dialog/mmu-selector-dialog.component';

@Component({
  selector: 'app-mmu-risk-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MmuRiskPanelComponent],
  providers: [MmuRiskStore],
  templateUrl: './mmu-risk-page.component.html',
  styleUrl: './mmu-risk-page.component.scss',
})
export class MmuRiskPageComponent {
  protected readonly store = inject(MmuRiskStore);
  private readonly dialog = inject(MatDialog);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);

  private openDialogRef: MatDialogRef<MmuSelectorDialogComponent, string | null> | null = null;

  // Single source of truth — no mirrored local signal.
  protected readonly isOpen = this.store.hasMmuSelected;

  constructor() {
    useShortcut('ctrl+a', () => this.toggle());
    useShortcut('escape', () => {
      if (this.isOpen()) {
        this.close();
        return;
      }
      return false;
    });
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.openDialogRef) return; // guard against double-open
    console.log('[mmu-risk] Open MMU Risk clicked');
    const ref = this.dialog.open(MmuSelectorDialogComponent, {
      viewContainerRef: this.viewContainerRef,
    });
    this.openDialogRef = ref;
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selected) => {
        this.openDialogRef = null;
        if (selected) this.store.enterMmu(selected);
      });
  }

  close(): void {
    console.log('[mmu-risk] Close MMU Risk clicked');
    this.store.reset();
  }
}
