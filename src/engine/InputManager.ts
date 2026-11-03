export type GameAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'sprint'
  | 'jump'
  | 'crouch'
  | 'cameraMode'
  | 'interact';

const KEYMAP: Record<string, GameAction> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  Space: 'jump',
  ControlLeft: 'crouch',
  KeyC: 'crouch',
  KeyV: 'cameraMode',
  KeyE: 'interact',
};

/**
 * Keyboard + mouse input with pointer-lock mouse look.
 * Phase 1 ships a fixed keymap; rebinding arrives with the settings overhaul.
 */
export class InputManager {
  private down = new Set<GameAction>();
  private pressed = new Set<GameAction>();
  private el: HTMLElement | null = null;
  look = { dx: 0, dy: 0 };
  wheel = 0;
  locked = false;
  onEscape: (() => void) | null = null;
  onLockChange: ((locked: boolean) => void) | null = null;

  private keyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') {
      this.onEscape?.();
      return;
    }
    const a = KEYMAP[e.code];
    if (!a) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) {
      this.down.add(a);
      this.pressed.add(a);
    }
  };

  private keyUp = (e: KeyboardEvent): void => {
    const a = KEYMAP[e.code];
    if (a) this.down.delete(a);
  };

  private mouseMove = (e: MouseEvent): void => {
    if (this.locked) {
      this.look.dx += e.movementX;
      this.look.dy += e.movementY;
    }
  };

  private wheelEvt = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheel += e.deltaY;
  };

  private blur = (): void => {
    this.down.clear();
  };

  private lockChange = (): void => {
    this.locked = document.pointerLockElement === this.el;
    this.onLockChange?.(this.locked);
    if (!this.locked) this.down.clear();
  };

  attach(el: HTMLElement): void {
    this.el = el;
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.blur);
    document.addEventListener('mousemove', this.mouseMove);
    el.addEventListener('wheel', this.wheelEvt, { passive: false });
    document.addEventListener('pointerlockchange', this.lockChange);
  }

  detach(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('blur', this.blur);
    document.removeEventListener('mousemove', this.mouseMove);
    if (this.el) this.el.removeEventListener('wheel', this.wheelEvt);
    document.removeEventListener('pointerlockchange', this.lockChange);
    this.el = null;
    this.down.clear();
    this.pressed.clear();
  }

  isDown(a: GameAction): boolean {
    return this.down.has(a);
  }

  wasPressed(a: GameAction): boolean {
    return this.pressed.has(a);
  }

  consumeLook(): { dx: number; dy: number } {
    const r = { dx: this.look.dx, dy: this.look.dy };
    this.look.dx = 0;
    this.look.dy = 0;
    return r;
  }

  consumeWheel(): number {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  /** Clear per-frame edge-detected presses. Call once at end of frame. */
  postUpdate(): void {
    this.pressed.clear();
  }

  requestLock(): void {
    const el = this.el;
    if (!el) return;
    try {
      const p = el.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          /* stale user gesture — the next click on the canvas re-locks */
        });
      }
    } catch {
      /* pointer lock unavailable — mouse look simply stays off */
    }
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
