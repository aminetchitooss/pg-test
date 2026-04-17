import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutService } from './shortcut.service';
import { useShortcut } from './use-shortcut';

function dispatchKey(init: Partial<KeyboardEventInit> & { key: string; code?: string }): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: init.key,
      code: init.code ?? '',
      ctrlKey: init.ctrlKey,
      metaKey: init.metaKey,
      shiftKey: init.shiftKey,
      altKey: init.altKey,
      bubbles: true,
      cancelable: true,
    }),
  );
}

describe('ShortcutService', () => {
  let service: ShortcutService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShortcutService);
  });

  it('invokes a registered handler on matching keydown', () => {
    const spy = vi.fn();
    service.register('ctrl+s', spy);
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('unregister removes only the given handler reference', () => {
    const a = vi.fn();
    const b = vi.fn();
    service.register('ctrl+s', a);
    service.register('ctrl+s', b);
    service.unregister('ctrl+s', a);
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('LIFO: newest handler runs first; older handlers do not fire by default', () => {
    const older = vi.fn();
    const newer = vi.fn();
    service.register('ctrl+s', older);
    service.register('ctrl+s', newer);
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).not.toHaveBeenCalled();
  });

  it('handler returning false passes through to the next in the stack', () => {
    const older = vi.fn();
    const newer = vi.fn(() => false as const);
    service.register('ctrl+s', older);
    service.register('ctrl+s', newer);
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(newer).toHaveBeenCalledTimes(1);
    expect(older).toHaveBeenCalledTimes(1);
  });

  it('calls preventDefault + stopPropagation when a handler handles the event', () => {
    service.register('ctrl+s', () => {});
    const ev = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(ev, 'preventDefault');
    const stop = vi.spyOn(ev, 'stopPropagation');
    document.dispatchEvent(ev);
    expect(prevent).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('does NOT preventDefault when every handler returns false', () => {
    service.register('ctrl+s', () => false);
    const ev = new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const prevent = vi.spyOn(ev, 'preventDefault');
    document.dispatchEvent(ev);
    expect(prevent).not.toHaveBeenCalled();
  });

  it('skips dispatch when the target is an input/textarea/contentEditable', () => {
    const spy = vi.fn();
    service.register('ctrl+s', spy);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 's',
        code: 'KeyS',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('pauseAll suspends dispatch; resumeAll restores', () => {
    const spy = vi.fn();
    service.register('ctrl+s', spy);

    service.pauseAll();
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(spy).not.toHaveBeenCalled();

    service.resumeAll();
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('pauseAll is reference-counted (nested pauses require matching resumes)', () => {
    const spy = vi.fn();
    service.register('ctrl+s', spy);

    service.pauseAll();
    service.pauseAll();
    service.resumeAll();
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(spy).not.toHaveBeenCalled();

    service.resumeAll();
    dispatchKey({ key: 's', code: 'KeyS', ctrlKey: true });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('useShortcut composable', () => {
  @Component({ template: '', standalone: true })
  class HostComponent {
    readonly handler = vi.fn();
    constructor() {
      useShortcut('ctrl+k', this.handler);
    }
  }

  it('auto-unregisters when the host is destroyed', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(HostComponent);
    const host = fixture.componentInstance;

    dispatchKey({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(host.handler).toHaveBeenCalledTimes(1);

    fixture.destroy();

    dispatchKey({ key: 'k', code: 'KeyK', ctrlKey: true });
    expect(host.handler).toHaveBeenCalledTimes(1); // no increase
  });

  it('requires an injection context', () => {
    TestBed.configureTestingModule({});
    // calling useShortcut outside an injection context throws from inject()
    expect(() => useShortcut('ctrl+q', () => {})).toThrow();
  });

  it('works via TestBed.runInInjectionContext', () => {
    TestBed.configureTestingModule({});
    const handler = vi.fn();
    TestBed.runInInjectionContext(() => useShortcut('ctrl+y', handler));
    dispatchKey({ key: 'y', code: 'KeyY', ctrlKey: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
