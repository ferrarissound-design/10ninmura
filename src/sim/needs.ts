import { CONFIG } from '../config';
import type { Npc } from '../npc/Npc';

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function decayNeeds(npc: Npc, minutesDelta: number): void {
  const n = npc.needs;
  n.hunger = clamp(n.hunger + CONFIG.needs.hungerPerMinute * minutesDelta);
  n.fatigue = clamp(n.fatigue + CONFIG.needs.fatiguePerMinute * minutesDelta);
  n.loneliness = clamp(n.loneliness + CONFIG.needs.lonelinessPerMinute * minutesDelta);
  n.fun = clamp(n.fun + CONFIG.needs.funDecayPerMinute * minutesDelta);
  n.social = clamp(n.social + CONFIG.needs.socialDecayPerMinute * minutesDelta);
}

export function recoverEat(npc: Npc): void {
  npc.needs.hunger = clamp(npc.needs.hunger - CONFIG.needs.eatRecoverAmount);
}

export function recoverSleep(npc: Npc, minutesDelta: number): void {
  npc.needs.fatigue = clamp(npc.needs.fatigue - (CONFIG.needs.sleepRecoverAmount / 480) * minutesDelta);
}

export function recoverSocial(npc: Npc): void {
  npc.needs.loneliness = clamp(npc.needs.loneliness - CONFIG.needs.talkLonelinessRecover);
  npc.needs.social = clamp(npc.needs.social - CONFIG.needs.talkSocialRecover);
}

export function recoverFunWalk(npc: Npc): void {
  npc.needs.fun = clamp(npc.needs.fun - CONFIG.needs.walkFunRecover);
}

export function recoverFunPlaza(npc: Npc, minutesDelta: number): void {
  npc.needs.fun = clamp(npc.needs.fun - (CONFIG.needs.plazaFunRecover / 30) * minutesDelta);
  npc.needs.loneliness = clamp(npc.needs.loneliness - (CONFIG.needs.talkLonelinessRecover / 60) * minutesDelta);
}
