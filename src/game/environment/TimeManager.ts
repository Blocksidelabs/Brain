export type TimeSpeed = 'paused' | 'slow' | 'normal' | 'fast';

const SPEEDS: Record<TimeSpeed, number> = {
  paused: 0,
  slow: 0.25,
  normal: 1,
  fast: 4,
};

/**
 * Encapsulates the continuous 24-hour clock.
 * 0.0 = Midnight, 12.0 = Noon.
 */
export class TimeManager {
  time: number = 8.0; // Start at 8 AM
  speedSetting: TimeSpeed = 'normal';
  auto = true;

  update(dt: number): void {
    if (!this.auto) return;
    const multiplier = SPEEDS[this.speedSetting];
    if (multiplier === 0) return;
    // Full cycle in ~10 mins at normal speed
    this.time = (this.time + (dt * 24) / 600 * multiplier) % 24;
  }

  setHour(hour: number): void {
    this.time = ((hour % 24) + 24) % 24;
  }

  get hour(): number {
    return Math.floor(this.time);
  }

  get minutes(): number {
    return Math.floor((this.time - this.hour) * 60);
  }

  get progress(): number {
    return this.time / 24;
  }

  /** 0 = deep night, 1 = full day */
  get daylight(): number {
    // Sun altitude approximation
    const ang = ((this.time - 6) / 24) * Math.PI * 2;
    const sunH = Math.sin(ang);
    return Math.max(0, Math.min(1, sunH * 2.2 + 0.1));
  }

  clockString(): string {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')}`;
  }
}
