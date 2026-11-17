import { useCallback, useEffect, useRef, useState } from 'react';
import { BlocksideGame } from './game/BlocksideGame';
import { GameManager } from './engine/GameManager';
import { QUALITY_PRESETS, detectReducedMotion } from './engine/quality';
import { announceZone, getState, patchHud, setScreen, setState, useBlockside } from './state/store';
import { MainMenu } from './ui/MainMenu';
import { HUD } from './ui/HUD';
import { PauseMenu } from './ui/PauseMenu';
import { SettingsPanel } from './ui/SettingsPanel';
import { ControlsModal } from './ui/ControlsModal';

type Modal = 'none' | 'settings' | 'controls';

export default function App() {
  const s = useBlockside();
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<BlocksideGame | null>(null);
  const gmRef = useRef<GameManager | null>(null);
  const [modal, setModal] = useState<Modal>('none');

  // Live-apply settings changes.
  useEffect(() => {
    gameRef.current?.applySettings(s.settings);
    gmRef.current?.setQuality(QUALITY_PRESETS[s.settings.quality]);
  }, [s.settings]);

  // Pause / resume with screen transitions.
  useEffect(() => {
    const gm = gmRef.current;
    const game = gameRef.current;
    if (!gm || !game) return;
    gm.setPaused(s.screen !== 'playing');
    game.setSuspended(s.screen !== 'playing');
    if (s.screen === 'playing') game.requestLock();
  }, [s.screen]);

  const startGame = useCallback(async () => {
    if (gameRef.current || !hostRef.current) return;
    const host = hostRef.current;
    setState({ loading: true });
    try {
      const reduced = detectReducedMotion();
      const game = new BlocksideGame(
        {
          getSettings: () => getState().settings,
          getQualityPreset: () => QUALITY_PRESETS[getState().settings.quality],
          onHud: patchHud,
          onZoneChange: announceZone,
          onLockChange: (locked) => {
            if (!locked && getState().screen === 'playing') setScreen('paused');
          },
          onEscape: () => {
            if (getState().screen === 'playing') setScreen('paused');
          },
        },
        reduced,
      );
      const gm = new GameManager(host, {
        quality: QUALITY_PRESETS[getState().settings.quality],
        reducedMotion: reduced,
        onFps: (fps) => patchHud({ fps }),
      });
      await gm.start((ctx) => game.build(ctx));
      gameRef.current = game;
      gmRef.current = gm;
      setScreen('playing');
      game.startAudio();
      game.requestLock();
    } catch (err) {
      console.error('[BLOCKSIDE] failed to start:', err);
    } finally {
      setState({ loading: false });
    }
  }, []);

  const exitToMenu = useCallback(() => {
    gameRef.current?.releaseLock();
    gmRef.current?.dispose();
    gameRef.current = null;
    gmRef.current = null;
    setScreen('menu');
  }, []);

  const resume = useCallback(() => setScreen('playing'), []);

  return (
    <div className="app">
      <div
        className="game-host"
        ref={hostRef}
        onClick={() => {
          if (s.screen === 'playing' && gameRef.current && !document.pointerLockElement) {
            gameRef.current.requestLock();
          }
        }}
      />
      {s.screen === 'menu' && (
        <MainMenu
          onPlay={startGame}
          onOpenSettings={() => setModal('settings')}
          onOpenControls={() => setModal('controls')}
        />
      )}
      {s.screen === 'playing' && <HUD />}
      {s.screen === 'paused' && (
        <>
          <HUD />
          <PauseMenu
            onResume={resume}
            onOpenSettings={() => setModal('settings')}
            onOpenControls={() => setModal('controls')}
            onExit={exitToMenu}
          />
        </>
      )}
      {s.loading && (
        <div className="loading-overlay">
          <img
            className="loading-logo"
            src="/branding/blockside-logo.png"
            alt="BLOCKSIDE"
            width={96}
            height={96}
            draggable={false}
          />
          <div className="loading-text neon-pink">LOADING THE CITY…</div>
          <div className="loading-sub">pouring neon into concrete</div>
        </div>
      )}
      {modal === 'settings' && <SettingsPanel onClose={() => setModal('none')} />}
      {modal === 'controls' && <ControlsModal onClose={() => setModal('none')} />}
    </div>
  );
}
