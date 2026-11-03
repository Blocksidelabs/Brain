const ROWS: Array<[string, string]> = [
  ['W / A / S / D', 'Move (camera-relative)'],
  ['SHIFT', 'Sprint'],
  ['SPACE', 'Jump'],
  ['CTRL (or C)', 'Crouch'],
  ['V', 'Switch camera (third ⇄ first person)'],
  ['MOUSE', 'Look (pointer lock)'],
  ['WHEEL', 'Camera distance (third person)'],
  ['ESC', 'Pause menu'],
  ['E', 'Interact — reserved for vehicles & missions'],
];

export function ControlsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title neon-pink">CONTROLS</h2>
        <div className="controls-table">
          {ROWS.map(([key, desc]) => (
            <div className="controls-row" key={key}>
              <span className="key">{key}</span>
              <span className="desc">{desc}</span>
            </div>
          ))}
        </div>
        <p className="modal-note">Click the game view to capture the mouse. Press ESC to release it.</p>
        <button className="btn" onClick={onClose}>
          DONE
        </button>
      </div>
    </div>
  );
}
