import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import {
  normalizeCombo,
  normalizeEvent,
  ShortcutHandler,
} from './shortcut.util';

@Injectable({ providedIn: 'root' })
export class ShortcutService implements OnDestroy {
  private readonly shortcuts = new Map<string, ShortcutHandler>();
  private pauseCount = 0;
  private readonly sub: Subscription;

  constructor(private readonly ngZone: NgZone) {
    this.sub = this.ngZone.runOutsideAngular(() => {
      const keydown$ = fromEvent<KeyboardEvent>(document, 'keydown');

      return keydown$
        .pipe(
          filter(() => !this.pauseCount),
          filter((ev) => !this.isEditableTarget(ev.target as HTMLElement)),
          map((ev) => ({ ev, combo: normalizeEvent(ev) })),
          filter(({ combo }) => this.validateShortcutPattern(combo)),
        )
        .subscribe(({ ev, combo }) => {
          ev.preventDefault();
          ev.stopPropagation();

          this.ngZone.run(() => {
            const handler = this.shortcuts.get(combo);
            if (handler) handler();
          });
        });
    });
  }

  register(combo: string, handler: ShortcutHandler): void {
    const norm = normalizeCombo(combo);
    this.shortcuts.set(norm, handler);
  }

  unregister(combo: string): void {
    const norm = normalizeCombo(combo);
    this.shortcuts.delete(norm);
  }

  pauseAll(): void {
    this.pauseCount++;
  }

  resumeAll(): void {
    if (this.pauseCount > 0) {
      this.pauseCount--;
    }
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;

    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
  }

  private validateShortcutPattern(combo: string) {
    return this.shortcuts.has(combo);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
