import { Injectable, computed, signal } from '@angular/core';

/**
 * A grid's server-side filter: a free-text SQL condition (`trade.id IN (10,20)`)
 * that the module appends to the query it sends, so it changes which rows come
 * back — unlike the Advanced Filter, which only narrows rows already loaded.
 *
 * Holds only state: the applied text and whether the feature is on. It knows
 * nothing about the API or where settings are stored — each module hydrates it
 * from its settings and reads `activeText()` when it builds its query (see credit
 * for the pattern). A module that never uses it is unaffected.
 */
@Injectable({ providedIn: 'root' })
export class GridServerFilterService {
  private _text = signal('');
  private _enabled = signal(false);
  private _error = signal<string | null>(null);

  /** The last applied text, kept while the feature is off so re-enabling restores it. */
  readonly text = this._text.asReadonly();
  readonly enabled = this._enabled.asReadonly();

  /** Why the server rejected the applied text, or null. Set by the module's fetch. */
  readonly error = this._error.asReadonly();

  /** What the query should carry: the text while the feature is on, else ''. */
  readonly activeText = computed(() => (this._enabled() ? this._text() : ''));

  hydrate(text: string | null | undefined, isEnabled = false): void {
    this._text.set((text ?? '').trim());
    this._enabled.set(isEnabled);
  }

  setError(message: string | null): void {
    this._error.set(message);
  }

  setEnabled(enabled: boolean): void {
    this._enabled.set(enabled);
  }

  /** Returns true when the applied text actually changed. */
  apply(text: string): boolean {
    const next = text.trim();
    if (next === this._text()) return false;
    this._text.set(next);
    this._error.set(null);
    return true;
  }

  clear(): boolean {
    return this.apply('');
  }
}
