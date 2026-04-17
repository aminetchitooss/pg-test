import { DestroyRef, inject } from '@angular/core';
import { ShortcutService } from './shortcut.service';
import type { ShortcutHandler } from './shortcut.util';

/**
 * Registers a keyboard shortcut and automatically unregisters it when the
 * current injection context is destroyed. Must be called in an injection
 * context (component, directive, service constructor, or `runInInjectionContext`).
 */
export function useShortcut(combo: string, handler: ShortcutHandler): void {
  const service = inject(ShortcutService);
  const destroyRef = inject(DestroyRef);
  service.register(combo, handler);
  destroyRef.onDestroy(() => service.unregister(combo, handler));
}
