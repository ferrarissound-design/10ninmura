import type { World } from '../sim/World';
import { formatClockOnly } from '../sim/eventLog';

export class TimeUI {
  private world: World;
  private clockTimeEl = document.getElementById('clock-time')!;
  private clockDayEl = document.getElementById('clock-day')!;
  private buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.speed-btn'));

  constructor(world: World) {
    this.world = world;
    for (const btn of this.buttons) {
      btn.addEventListener('click', () => {
        const speed = Number(btn.dataset.speed);
        this.world.speedMultiplier = speed;
        this.updateActive();
      });
    }
    this.updateActive();
  }

  setWorld(world: World): void {
    this.world = world;
    this.world.speedMultiplier = this.currentSpeed();
  }

  private currentSpeed(): number {
    const active = this.buttons.find((b) => b.classList.contains('active'));
    return active ? Number(active.dataset.speed) : 1;
  }

  private updateActive(): void {
    for (const btn of this.buttons) {
      btn.classList.toggle('active', Number(btn.dataset.speed) === this.world.speedMultiplier);
    }
  }

  refreshClock(): void {
    const { time, day } = formatClockOnly(this.world.tick);
    this.clockTimeEl.textContent = time;
    this.clockDayEl.textContent = `${day}日目`;
  }
}
