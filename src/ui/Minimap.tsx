import { useEffect, useRef } from 'react';
import { registerMinimap } from '../state/minimapRegistry';

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    registerMinimap(ref.current);
    return () => registerMinimap(null);
  }, []);
  return (
    <div className="minimap-wrap">
      <canvas ref={ref} width={176} height={176} className="minimap" />
      <div className="minimap-compass">N</div>
    </div>
  );
}
