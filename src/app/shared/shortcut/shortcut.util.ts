export type ShortcutHandler = () => void;

export enum CanonicalKey {
  // Modifiers
  Control = 'Control',
  Meta = 'Meta',
  Shift = 'Shift',
  Alt = 'Alt',

  // Special non-character keys
  Enter = 'Enter',
  Escape = 'Escape',
  Backspace = 'Backspace',
  Tab = 'Tab',
  Space = 'Space',
  PageUp = 'PageUp',
  PageDown = 'PageDown',
  Home = 'Home',
  End = 'End',
  ArrowLeft = 'ArrowLeft',
  ArrowUp = 'ArrowUp',
  ArrowRight = 'ArrowRight',
  ArrowDown = 'ArrowDown',
}

export const MODIFIER_KEYS = Object.freeze({
  Control: CanonicalKey.Control,
  Meta: CanonicalKey.Meta,
  Shift: CanonicalKey.Shift,
  Alt: CanonicalKey.Alt,
} as const);

export const NAMED_KEYS = Object.freeze({
  ctrl: CanonicalKey.Control,
  control: CanonicalKey.Control,
  cmd: CanonicalKey.Meta,
  meta: CanonicalKey.Meta,
  shift: CanonicalKey.Shift,
  alt: CanonicalKey.Alt,

  enter: CanonicalKey.Enter,
  esc: CanonicalKey.Escape,
  escape: CanonicalKey.Escape,
  backspace: CanonicalKey.Backspace,
  tab: CanonicalKey.Tab,
  space: CanonicalKey.Space,
  pageup: CanonicalKey.PageUp,
  pagedown: CanonicalKey.PageDown,
  home: CanonicalKey.Home,
  end: CanonicalKey.End,
  left: CanonicalKey.ArrowLeft,
  up: CanonicalKey.ArrowUp,
  right: CanonicalKey.ArrowRight,
  down: CanonicalKey.ArrowDown,
} as const);

type NamedKey = keyof typeof NAMED_KEYS;

export function normalizeEvent(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push(MODIFIER_KEYS.Control);
  if (event.metaKey) parts.push(MODIFIER_KEYS.Meta);
  if (event.shiftKey) parts.push(MODIFIER_KEYS.Shift);
  if (event.altKey) parts.push(MODIFIER_KEYS.Alt);

  const keyPart = resolveKeyPart(event);
  parts.push(keyPart);

  return parts.join('.'); // smth like this "Control.Shift.KeyS"
}

export function normalizeCombo(rawCombo: string): string {
  return rawCombo
    .replace(/[+]/g, '.') // aslo allow + as separator
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

function resolveKeyPart(event: KeyboardEvent): string {
  const key = event.key;
  const isSingleChar = key.length === 1;

  if (isSingleChar) {
    const upper = key.toUpperCase();

    if (/^[A-Z]$/.test(upper)) return `Key${upper}`;

    if (/^[0-9]$/.test(upper)) return `Digit${upper}`;

    return key;
  }

  return event.code;
}
