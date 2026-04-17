import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, NgZone, OnDestroy, PLATFORM_ID } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { normalizeCombo, normalizeEvent, ShortcutHandler } from './shortcut.util';

@Injectable({ providedIn: 'root' })
export class ShortcutService implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** LIFO stack of handlers per normalized combo. */
  private readonly shortcuts = new Map<string, ShortcutHandler[]>();
  private pauseCount = 0;
  private readonly sub: Subscription | null;

  constructor() {
    if (!this.isBrowser) {
      this.sub = null;
      return;
    }

    this.sub = this.ngZone.runOutsideAngular(() => {
      const keydown$ = fromEvent<KeyboardEvent>(this.document, 'keydown');

      return keydown$
        .pipe(
          filter(() => !this.pauseCount),
          filter((ev) => !this.isEditableTarget(ev.target)),
          map((ev) => ({ ev, combo: normalizeEvent(ev) })),
          filter(({ combo }) => this.hasHandler(combo)),
        )
        .subscribe(({ ev, combo }) => {
          this.ngZone.run(() => this.dispatch(ev, combo));
        });
    });
  }

  /** Register a handler. Newer registrations shadow older ones (LIFO). */
  register(combo: string, handler: ShortcutHandler): void {
    const norm = normalizeCombo(combo);
    const stack = this.shortcuts.get(norm);
    if (stack) {
      stack.push(handler);
    } else {
      this.shortcuts.set(norm, [handler]);
    }
  }

  /** Remove the given handler. Pass the same reference that was registered. */
  unregister(combo: string, handler: ShortcutHandler): void {
    const norm = normalizeCombo(combo);
    const stack = this.shortcuts.get(norm);
    if (!stack) return;
    const i = stack.lastIndexOf(handler);
    if (i !== -1) stack.splice(i, 1);
    if (stack.length === 0) this.shortcuts.delete(norm);
  }

  pauseAll(): void {
    this.pauseCount++;
  }

  resumeAll(): void {
    if (this.pauseCount > 0) this.pauseCount--;
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private dispatch(ev: KeyboardEvent, combo: string): void {
    const stack = this.shortcuts.get(combo);
    if (!stack?.length) return;

    // LIFO: newest handler gets first shot.
    for (let i = stack.length - 1; i >= 0; i--) {
      const result = stack[i]();
      if (result !== false) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
    }
    // Every handler returned false → let the browser do its thing.
  }

  private hasHandler(combo: string): boolean {
    const stack = this.shortcuts.get(combo);
    return !!stack && stack.length > 0;
  }

  private isEditableTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || target.isContentEditable;
  }
}
