/**
 * Handler invoked when a registered shortcut fires.
 *
 * Return `false` to pass through to the next handler in the LIFO stack
 * (useful when a parent wants to claim the shortcut if its child didn't).
 * Return `void`, `true`, or omit a return to mark the shortcut as handled —
 * dispatch stops and `preventDefault()` / `stopPropagation()` are called.
 */
export type ShortcutHandler = () => boolean | void;

export type CanonicalKey =
  | 'Control'
  | 'Meta'
  | 'Shift'
  | 'Alt'
  | 'Enter'
  | 'Escape'
  | 'Backspace'
  | 'Tab'
  | 'Space'
  | 'PageUp'
  | 'PageDown'
  | 'Home'
  | 'End'
  | 'ArrowLeft'
  | 'ArrowUp'
  | 'ArrowRight'
  | 'ArrowDown';

export const MODIFIER_KEYS = {
  Control: 'Control',
  Meta: 'Meta',
  Shift: 'Shift',
  Alt: 'Alt',
} as const satisfies Record<string, CanonicalKey>;

export const NAMED_KEYS = {
  ctrl: 'Control',
  control: 'Control',
  cmd: 'Meta',
  meta: 'Meta',
  shift: 'Shift',
  alt: 'Alt',

  enter: 'Enter',
  esc: 'Escape',
  escape: 'Escape',
  backspace: 'Backspace',
  tab: 'Tab',
  space: 'Space',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
  left: 'ArrowLeft',
  up: 'ArrowUp',
  right: 'ArrowRight',
  down: 'ArrowDown',
} as const satisfies Record<string, CanonicalKey>;

type NamedKey = keyof typeof NAMED_KEYS;

export function normalizeEvent(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push(MODIFIER_KEYS.Control);
  if (event.metaKey) parts.push(MODIFIER_KEYS.Meta);
  if (event.shiftKey) parts.push(MODIFIER_KEYS.Shift);
  if (event.altKey) parts.push(MODIFIER_KEYS.Alt);

  // event.code reflects the physical key regardless of OS modifier layout,
  // so Alt+M produces "KeyM" on Mac (where event.key is "µ") just like Windows.
  parts.push(event.code);

  return parts.join('.'); // e.g. "Control.Shift.KeyS"
}

export function normalizeCombo(rawCombo: string): string {
  return rawCombo
    .replace(/[+]/g, '.') // accept + as separator too
    .replace(/\s+/g, '')
    .toLowerCase()
    .split('.')
    .map((part) => {
      const named = NAMED_KEYS[part as NamedKey];
      if (named) return named;

      const upper = part.toUpperCase();
      if (/^[A-Z]$/.test(upper)) return `Key${upper}`;
      if (/^[0-9]$/.test(upper)) return `Digit${upper}`;

      return part;
    })
    .join('.');
}

