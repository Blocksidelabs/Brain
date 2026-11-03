import { useBlockside } from '../state/store';
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
        <span className="hud-fps">{s.hud.fps} FPS</span>
      </div>
      {s.zoneBanner && <ZoneBanner key={s.zoneBanner.seq} name={s.zoneBanner.name} />}
      {s.hud.prompt && <div className="hud-prompt">{s.hud.prompt}</div>}
    </div>
  );
}

function ZoneBanner({ name }: { name: string }) {
  return <div className="zone-banner">{name}</div>;
}
