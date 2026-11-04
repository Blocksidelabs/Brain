import { useBlockside, type VehicleHud } from '../state/store';
import { Minimap } from './Minimap';

export function HUD() {
  const s = useBlockside();
  return (
    <div className="hud">
      <div className="hud-top-left">
        <div className="hud-zone neon-pink">{s.hud.zone}</div>
        <div className="hud-clock">{s.hud.clock}</div>
      </div>
      <div className="hud-top-right">
        <div className="hud-money">${s.hud.money.toLocaleString('en-US')}</div>
        <div className="hud-health" title={`Health ${s.hud.health}`}>
          <div className="hud-health-fill" style={{ width: `${s.hud.health}%` }} />
        </div>
      </div>
      <Minimap />
      <div className="hud-bottom-right">
        {s.hud.vehicle && <DriveHud v={s.hud.vehicle} />}
        <span className="hud-fps">{s.hud.fps} FPS</span>
      </div>
      {s.zoneBanner && <ZoneBanner key={s.zoneBanner.seq} name={s.zoneBanner.name} />}
      {s.hud.prompt && <div className="hud-prompt">{s.hud.prompt}</div>}
    </div>
  );
}

function DriveHud({ v }: { v: VehicleHud }) {
  return (
    <div className="drive-hud">
      <div className="drive-name">{v.name}</div>
      <div className="drive-main">
        <div className="drive-speed neon-pink">{Math.round(v.speedKmh)}</div>
        <div className="drive-side">
          <div className="drive-unit">KM/H</div>
          <div className="drive-gear">{v.gear}</div>
        </div>
      </div>
      <div className="drive-rows">
        <Meter label="RPM" value={v.rpm / 7200} className="meter-rpm" />
        <Meter label="FUEL" value={v.fuel / 100} className="meter-fuel" />
        <Meter label="COND" value={v.condition / 100} className="meter-cond" />
      </div>
      <div className="drive-flags">
        <span className={`flag ${v.handbrake ? 'on' : ''}`}>HANDBRAKE</span>
        <span className="flag locked" title="Unlocks with the upgrade system">
          NITRO · LOCKED
        </span>
      </div>
    </div>
  );
}

function Meter({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="meter">
      <span className="meter-label">{label}</span>
      <div className="meter-track">
        <div className={`meter-fill ${className}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
      </div>
    </div>
  );
}

function ZoneBanner({ name }: { name: string }) {
  return <div className="zone-banner">{name}</div>;
}
