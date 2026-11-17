import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  announceZone,
  getState,
  patchHud,
  patchSettings,
  setState,
  subscribe,
} from '../src/state/store';

describe('store', () => {
  beforeEach(() => {
    setState({
      screen: 'menu',
      loading: false,
      settings: { ...DEFAULT_SETTINGS },
      hud: { zone: '—', clock: '—', weather: 'SUNNY', health: 100, money: 0, fps: 0, prompt: null, vehicle: null, mission: null },
      zoneBanner: null,
    });
  });

  it('starts with default settings', () => {
    expect(getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(getState().screen).toBe('menu');
  });

  it('notifies subscribers on change and supports unsubscribe', () => {
    const spy = vi.fn();
    const unsub = subscribe(spy);
    patchHud({ money: 250 });
    expect(spy).toHaveBeenCalled();
    expect(getState().hud.money).toBe(250);
    spy.mockClear();
    unsub();
    patchHud({ money: 300 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('patches settings immutably', () => {
    const before = getState().settings;
    patchSettings({ sensitivity: 1.5 });
    expect(getState().settings.sensitivity).toBe(1.5);
    expect(getState().settings).not.toBe(before);
    expect(before.sensitivity).toBe(1);
  });

  it('announces zones with an increasing sequence', () => {
    announceZone('DOWNTOWN');
    const first = getState().zoneBanner!;
    announceZone('OCEANFRONT');
    const second = getState().zoneBanner!;
    expect(second.seq).toBe(first.seq + 1);
    expect(second.name).toBe('OCEANFRONT');
  });
});
