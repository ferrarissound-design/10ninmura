import { CONFIG } from '../config';
import { addMemory } from './memory';
import type { Npc } from '../npc/Npc';
import type { RelationshipMatrix } from './relationships';
import type { EventLog } from './eventLog';
import type { Rng } from '../rng';

export interface RomanceContext {
  npcs: Npc[];
  relationships: RelationshipMatrix;
  eventLog: EventLog;
  rng: Rng;
  tick: number;
}

// 恋愛感情の芽生えを判定する。交流とは独立して、1日に数回程度呼ばれる想定。
export function updateCrushFormation(npc: Npc, ctx: RomanceContext): void {
  if (npc.romance.stage === 'dating') return;
  if (npc.romance.stage === 'heartbroken' && ctx.tick - npc.romance.since < 24 * 60) return;

  const row = ctx.relationships.rowFor(npc.id);
  let bestId: string | null = null;
  let bestScore: number = CONFIG.romance.crushThreshold;
  for (const [id, edge] of row) {
    if (npc.romance.exIds.includes(id) && ctx.rng.bool(0.7)) continue;
    const other = ctx.npcs.find((n) => n.id === id);
    if (!other || other.romance.stage === 'dating') continue;
    const score =
      edge.affection * 0.55 +
      edge.trust * 0.25 +
      npc.personality.romanceDrive * 0.25 +
      ctx.rng.range(-8, 8);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  if (bestId && npc.romance.targetId !== bestId) {
    const target = ctx.npcs.find((n) => n.id === bestId)!;
    npc.romance = { stage: 'crush', targetId: bestId, since: ctx.tick, exIds: npc.romance.exIds };
    ctx.relationships.adjustRomance(npc.id, bestId, 18);
    addMemory(npc, ctx.tick, 'cheerful_chat_with', bestId, 15, `${target.name}のことが気になり始めた`);
  } else if (npc.romance.stage === 'crush' && npc.romance.targetId) {
    ctx.relationships.adjustRomance(npc.id, npc.romance.targetId, 4);
  }
}

// 交際中のカップルの破局判定。
export function updateBreakupCheck(npc: Npc, ctx: RomanceContext): void {
  if (npc.romance.stage !== 'dating' || !npc.romance.targetId) return;
  const partnerId = npc.romance.targetId;
  const partner = ctx.npcs.find((n) => n.id === partnerId);
  if (!partner) return;

  const e = ctx.relationships.get(npc.id, partnerId);
  const back = ctx.relationships.get(partnerId, npc.id);

  const shouldBreakUp =
    e.affection < -15 ||
    back.affection < -15 ||
    e.grudge > CONFIG.romance.breakupGrudgeThreshold ||
    back.grudge > CONFIG.romance.breakupGrudgeThreshold;

  if (!shouldBreakUp) return;

  npc.romance = { stage: 'heartbroken', targetId: null, since: ctx.tick, exIds: [...npc.romance.exIds, partnerId] };
  partner.romance = { stage: 'heartbroken', targetId: null, since: ctx.tick, exIds: [...partner.romance.exIds, npc.id] };
  addMemory(npc, ctx.tick, 'broken_up_with', partnerId, 85, `${partner.name}と別れた`);
  addMemory(partner, ctx.tick, 'broken_up_with', npc.id, 85, `${npc.name}と別れた`);
  ctx.relationships.adjustRomance(npc.id, partnerId, -60);
  ctx.relationships.adjustRomance(partnerId, npc.id, -60);
  ctx.eventLog.push(ctx.tick, `${npc.name}と${partner.name}が別れた`, [npc.id, partnerId], true);
}
