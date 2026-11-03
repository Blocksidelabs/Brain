import { patchSettings, useBlockside } from '../state/store';
import type { QualityId } from '../engine/quality';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useBlockside();
  const st = s.settings;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title neon-pink">SETTINGS</h2>
        <div className="setting-row">
          <span>QUALITY</span>
          <div className="seg">
            {(['low', 'medium', 'high'] as QualityId[]).map((q) => (
              <button
                key={q}
                className={`seg-btn ${st.quality === q ? 'active' : ''}`}
                onClick={() => patchSettings({ quality: q })}
              >
                {q.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="setting-row">
          <span>MASTER VOLUME</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={st.masterVolume}
            onChange={(e) => patchSettings({ masterVolume: Number(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <span>SYNTHWAVE RADIO</span>
          <button className={`toggle ${st.musicOn ? 'on' : ''}`} onClick={() => patchSettings({ musicOn: !st.musicOn })}>
            {st.musicOn ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="setting-row">
          <span>MOUSE SENSITIVITY</span>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.05}
            value={st.sensitivity}
            onChange={(e) => patchSettings({ sensitivity: Number(e.target.value) })}
          />
        </div>
        <div className="setting-row">
          <span>INVERT LOOK Y</span>
          <button className={`toggle ${st.invertY ? 'on' : ''}`} onClick={() => patchSettings({ invertY: !st.invertY })}>
            {st.invertY ? 'ON' : 'OFF'}
          </button>
        </div>
        <button className="btn" onClick={onClose}>
          DONE
        </button>
      </div>
    </div>
  );
}
