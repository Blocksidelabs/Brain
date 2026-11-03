import { useSyncExternalStore } from 'react';
import type { QualityId } from '../engine/quality';

export type Screen = 'menu' | 'playing' | 'paused';

export interface GameSettings {
  quality: QualityId;
  masterVolume: number; // 0..1
  musicOn: boolean;
  sensitivity: number; // multiplier, 1 = default
  invertY: boolean;
}

export interface HudState {
  zone: string;
  clock: string;
  health: number;
  money: number;
  fps: number;
  prompt: string | null;
}

export interface BlocksideState {
  screen: Screen;
  loading: boolean;
  settings: GameSettings;
  hud: HudState;
  zoneBanner: { name: string; seq: number } | null;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  masterVolume: 0.8,
  musicOn: true,
  sensitivity: 1,
  invertY: false,
};

const SETTINGS_KEY = 'blockside.settings.v1';

function loadSettings(): GameSettings {
  if (typeof window === 'undefined' || !window.localStorage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let state: BlocksideState = {
  screen: 'menu',
  loading: false,
  settings: loadSettings(),
  hud: { zone: '—', clock: '—', health: 100, money: 0, fps: 0, prompt: null },
  zoneBanner: null,
};

const listeners = new Set<() => void>();

function persistSettings(s: GameSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — settings stay session-only */
  }
}

export function getState(): BlocksideState {
  return state;
}

export function setState(patch: Partial<BlocksideState>): void {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export function setScreen(screen: Screen): void {
  setState({ screen });
}

export function patchSettings(patch: Partial<GameSettings>): void {
  const settings = { ...state.settings, ...patch };
  persistSettings(settings);
  setState({ settings });
}

export function patchHud(patch: Partial<HudState>): void {
  setState({ hud: { ...state.hud, ...patch } });
}

export function announceZone(name: string): void {
  setState({ zoneBanner: { name, seq: (state.zoneBanner?.seq ?? 0) + 1 } });
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React hook — re-renders subscribers whenever the store changes. */
export function useBlockside(): BlocksideState {
  return useSyncExternalStore(subscribe, getState, getState);
}
