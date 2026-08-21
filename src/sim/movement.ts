import { CONFIG } from '../config';
import type { Npc } from '../npc/Npc';
import { chooseNextActivity, type BehaviorContext } from './behavior';
import { recoverEat, recoverFunPlaza, recoverFunWalk, recoverSleep } from './needs';

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function applyDwellEffects(npc: Npc, minutesDelta: number): void {
  switch (npc.activity) {
    case 'sleeping':
      recoverSleep(npc, minutesDelta);
      break;
    case 'at_plaza':
      recoverFunPlaza(npc, minutesDelta);
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
      npc.activityStarted = npc.pausedActivityStarted;
      npc.dwellUntilTick = npc.activityStarted ? ctx.tick + npc.pausedDwellRemainingMinutes : 0;
      npc.pausedActivity = null;
      npc.pausedDestination = null;
    } else {
      return;
    }
  }

  if (npc.activity === 'visiting' && !npc.activityStarted && npc.activityTargetNpcId && npc.destination) {
    const target = ctx.npcs.find((other) => other.id === npc.activityTargetNpcId);
    if (target) {
      npc.destination.x = target.position.x;
      npc.destination.z = target.position.z;
    }
  }

  if (npc.destination) {
    const dx = npc.destination.x - npc.position.x;
    const dz = npc.destination.z - npc.position.z;
    const dist = Math.hypot(dx, dz);
    const arriveDistance = npc.activity === 'visiting' ? CONFIG.interaction.radius * 0.6 : CONFIG.movement.arriveDistance;
    if (dist > arriveDistance) {
      const step = CONFIG.movement.speed * simDeltaSeconds;
      const t = Math.min(1, step / Math.max(dist, 0.0001));
      npc.position.x += dx * t;
      npc.position.z += dz * t;
      if (dx !== 0 || dz !== 0) npc.facing = Math.atan2(dx, dz);
      return;
    }
    if (npc.activity !== 'visiting') {
      npc.position.x = npc.destination.x;
      npc.position.z = npc.destination.z;
    }
    npc.destination = null;
    if (npc.activity === 'eating') recoverEat(npc);
    if (npc.activity === 'strolling') recoverFunWalk(npc);
    npc.activityStarted = true;
    npc.dwellUntilTick = ctx.tick + npc.activityDurationMinutes;
  }

  if (!npc.activityStarted) return;
  applyDwellEffects(npc, minutesDelta);

  if (ctx.tick >= npc.dwellUntilTick) {
    chooseNextActivity(npc, ctx);
  }
}
