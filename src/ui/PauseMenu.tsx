interface Props {
  onResume: () => void;
  onOpenSettings: () => void;
  onOpenControls: () => void;
  onExit: () => void;
}

export function PauseMenu({ onResume, onOpenSettings, onOpenControls, onExit }: Props) {
  return (
    <div className="pause-overlay">
      <div className="pause-panel">
        <img
          className="pause-logo"
          src="/branding/blockside-logo.png"
          alt="BLOCKSIDE"
          width={48}
          height={48}
          draggable={false}
        />
        <h2 className="pause-title neon-pink">PAUSED</h2>
        <button className="btn btn-primary" onClick={onResume}>
          RESUME
        </button>
        <button className="btn" onClick={onOpenSettings}>
          SETTINGS
        </button>
        <button className="btn" onClick={onOpenControls}>
          CONTROLS
        </button>
        <button className="btn btn-danger" onClick={onExit}>
          MAIN MENU
        </button>
        <p className="pause-hint">The neon keeps burning while you decide.</p>
      </div>
    </div>
  );
}
