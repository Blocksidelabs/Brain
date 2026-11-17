import { GAME_VERSION } from '../config/gameConfig';

interface Props {
  onPlay: () => void;
  onOpenSettings: () => void;
  onOpenControls: () => void;
}

const X_URL = 'https://x.com/RunOnBlockside';
const GITHUB_URL = 'https://github.com/Blocksidelabs';

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="social-icon-svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconGitHub() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="social-icon-svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.67C20.714 22.19 24 17.7 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export function MainMenu({ onPlay, onOpenSettings, onOpenControls }: Props) {
  return (
    <div className="menu-overlay">
      <div className="menu-skyline" aria-hidden="true" />
      
      {/* Header: Social Links (Top Right) */}
      <div className="menu-socials">
        <a href={X_URL} target="_blank" rel="noopener noreferrer" className="social-link" title="Official X" aria-label="Official X">
          <IconX />
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="social-link" title="GitHub Repository" aria-label="GitHub Repository">
          <IconGitHub />
        </a>
      </div>

      <div className="menu-content">
        <img
          className="menu-logo"
          src="/branding/blockside-logo.png"
          alt="BLOCKSIDE"
          width={128}
          height={128}
          draggable={false}
        />
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
        
        {/* Footer: Social Links (Bottom Center) */}
        <div className="menu-footer-socials">
          <a href={X_URL} target="_blank" rel="noopener noreferrer" className="social-link" title="Official X" aria-label="Official X">
            <IconX />
          </a>
          <span className="dot">•</span>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="social-link" title="GitHub Repository" aria-label="GitHub Repository">
            <IconGitHub />
          </a>
        </div>
        
        <div className="menu-version">v{GAME_VERSION}</div>
      </div>
    </div>
  );
}
