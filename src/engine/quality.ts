export type QualityId = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  bloom: boolean;
  cameraFar: number;
  fogDensity: number;
  bloomStrength: number;
}

export const QUALITY_PRESETS: Record<QualityId, QualityPreset> = {
  low: { pixelRatio: 1, shadows: false, shadowMapSize: 0, bloom: false, cameraFar: 480, fogDensity: 0.0042, bloomStrength: 0 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMapSize: 1024, bloom: true, cameraFar: 700, fogDensity: 0.0034, bloomStrength: 0.45 },
  high: { pixelRatio: 2, shadows: true, shadowMapSize: 2048, bloom: true, cameraFar: 900, fogDensity: 0.003, bloomStrength: 0.5 },
  ultra: { pixelRatio: 2, shadows: true, shadowMapSize: 4096, bloom: true, cameraFar: 1100, fogDensity: 0.0026, bloomStrength: 0.55 },
};

/** Simulated-agent caps per quality tier (pedestrians, AI vehicles). */
export const POPULATION_CAPS: Record<QualityId, { peds: number; cars: number }> = {
  low: { peds: 15, cars: 6 },
  medium: { peds: 25, cars: 10 },
  high: { peds: 40, cars: 16 },
  ultra: { peds: 55, cars: 22 },
};

/** Respect the OS/browser reduced-motion preference. */
export function detectReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
