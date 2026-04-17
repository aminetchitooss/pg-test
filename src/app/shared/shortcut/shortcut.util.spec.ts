import { describe, expect, it } from 'vitest';
import { normalizeCombo, normalizeEvent } from './shortcut.util';

function fakeEvent(overrides: Partial<KeyboardEventInit> & { key: string; code?: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key: overrides.key,
    code: overrides.code ?? '',
    ctrlKey: overrides.ctrlKey,
    metaKey: overrides.metaKey,
    shiftKey: overrides.shiftKey,
    altKey: overrides.altKey,
  });
}

describe('normalizeCombo', () => {
  it('converts common aliases to canonical form', () => {
    expect(normalizeCombo('ctrl+s')).toBe('Control.KeyS');
    expect(normalizeCombo('Ctrl+S')).toBe('Control.KeyS');
    expect(normalizeCombo('control + shift + s')).toBe('Control.Shift.KeyS');
    expect(normalizeCombo('cmd+k')).toBe('Meta.KeyK');
    expect(normalizeCombo('meta+k')).toBe('Meta.KeyK');
  });

  it('accepts . or + as separator, interchangeably', () => {
    expect(normalizeCombo('ctrl.shift.s')).toBe('Control.Shift.KeyS');
    expect(normalizeCombo('ctrl+shift.s')).toBe('Control.Shift.KeyS');
  });

  it('handles digits as DigitX', () => {
    expect(normalizeCombo('ctrl+3')).toBe('Control.Digit3');
  });

  it('resolves named non-character keys', () => {
    expect(normalizeCombo('esc')).toBe('Escape');
    expect(normalizeCombo('escape')).toBe('Escape');
    expect(normalizeCombo('space')).toBe('Space');
    expect(normalizeCombo('ctrl+left')).toBe('Control.ArrowLeft');
    expect(normalizeCombo('pageup')).toBe('PageUp');
  });

  it('preserves unknown tokens verbatim (lower-cased)', () => {
    expect(normalizeCombo('ctrl+foo')).toBe('Control.foo');
  });
});

describe('normalizeEvent', () => {
  it('builds canonical string from modifier flags + event.code', () => {
    const ev = fakeEvent({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(normalizeEvent(ev)).toBe('Control.KeyS');
  });

  it('orders modifiers Control → Meta → Shift → Alt', () => {
    const ev = fakeEvent({
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      metaKey: true,
      shiftKey: true,
      altKey: true,
    });
    expect(normalizeEvent(ev)).toBe('Control.Meta.Shift.Alt.KeyS');
  });

  it('maps single-char digit keys to DigitX', () => {
    const ev = fakeEvent({ key: '3', code: 'Digit3', ctrlKey: true });
    expect(normalizeEvent(ev)).toBe('Control.Digit3');
  });

  it('falls through to event.code for non-character keys', () => {
    const ev = fakeEvent({ key: 'Escape', code: 'Escape' });
    expect(normalizeEvent(ev)).toBe('Escape');
  });

  it('event and combo normalization converge on the same canonical form', () => {
    const ev = fakeEvent({ key: 's', code: 'KeyS', ctrlKey: true, shiftKey: true });
    expect(normalizeEvent(ev)).toBe(normalizeCombo('ctrl+shift+s'));
  });
});
