import { CONFIG } from '../config';
import type { Npc } from '../npc/Npc';
import { chooseNextActivity, type BehaviorContext } from './behavior';
import { recoverEat, recoverSleep } from './needs';

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function applyDwellEffects(npc: Npc, minutesDelta: number): void {
  switch (npc.activity) {
    case 'sleeping':
      recoverSleep(npc, minutesDelta);
      break;
    case 'at_plaza':
      npc.needs.fun = clamp(npc.needs.fun - (2.2 / 30) * minutesDelta);
      npc.needs.loneliness = clamp(npc.needs.loneliness - (3 / 30) * minutesDelta);
      break;
    case 'sitting':
      npc.needs.fatigue = clamp(npc.needs.fatigue - (5 / 30) * minutesDelta);
      break;
    case 'farming':
      npc.needs.loneliness = clamp(npc.needs.loneliness + (1 / 30) * minutesDelta);
      break;
    default:
      break;
  }
}

export function updateMovement(npc: Npc, ctx: BehaviorContext, simDeltaSeconds: number, minutesDelta: number): void {
  if (npc.activity === 'interacting') {
    if (ctx.tick >= npc.interactionEndTick) {
      npc.activity = npc.pausedActivity ?? 'idle';
      npc.destination = npc.pausedDestination;
      npc.destinationPoiId = npc.pausedDestinationPoiId;
      npc.dwellUntilTick = npc.pausedDwellUntilTick;
      npc.pausedActivity = null;
      npc.pausedDestination = null;
    } else {
      return;
    }
  }

  if (npc.destination) {
    const dx = npc.destination.x - npc.position.x;
    const dz = npc.destination.z - npc.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > CONFIG.movement.arriveDistance) {
      const step = CONFIG.movement.speed * simDeltaSeconds;
      const t = Math.min(1, step / Math.max(dist, 0.0001));
      npc.position.x += dx * t;
      npc.position.z += dz * t;
      if (dx !== 0 || dz !== 0) npc.facing = Math.atan2(dx, dz);
      return;
    }
    npc.position.x = npc.destination.x;
    npc.position.z = npc.destination.z;
    npc.destination = null;
    if (npc.activity === 'eating') recoverEat(npc);
  }

  applyDwellEffects(npc, minutesDelta);

  if (ctx.tick >= npc.dwellUntilTick) {
    chooseNextActivity(npc, ctx);
  }
}
