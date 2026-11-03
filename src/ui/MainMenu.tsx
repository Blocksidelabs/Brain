import { GAME_VERSION } from '../config/gameConfig';

interface Props {
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenControls: () => void;
}

export function MainMenu({ onPlay, onOpenSettings, onOpenControls }: Props) {
  return (
    <div className="menu-overlay">
      <div className="menu-skyline" aria-hidden="true" />
      <div className="menu-content">
        <h1 className="menu-title neon-pink">BLOCKSIDE</h1>
        <p className="menu-tagline">THE CITY IS YOURS.</p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={onPlay}>
            PLAY
          </button>
          <button className="btn" onClick={onOpenSettings}>
            SETTINGS
          </button>
          <button className="btn" onClick={onOpenControls}>
            CONTROLS
          </button>
        </div>
        <div className="menu-roadmap">
          <span>PHASE 1 BUILD</span>
          <span className="dot">•</span>
          <span>EXPLORE AN ORIGINAL NEON CITY</span>
          <span className="dot">•</span>
          <span>VEHICLES & MISSIONS ARRIVE IN LATER PHASES</span>
        </div>
        <div className="menu-version">v{GAME_VERSION}</div>
      </div>
    </div>
  );
}
