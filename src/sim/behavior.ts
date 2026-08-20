import { CONFIG } from '../config';
import type { Rng } from '../rng';
import type { Npc } from '../npc/Npc';
import { recoverFunWalk } from './needs';
import type { RelationshipMatrix } from './relationships';
import type { VillageLayout } from './villageLayout';
import { hourOfTick, isNight } from './time';

export interface BehaviorContext {
  layout: VillageLayout;
  npcs: Npc[];
  relationships: RelationshipMatrix;
  rng: Rng;
  tick: number;
}

function npcHouse(ctx: BehaviorContext, npc: Npc): { x: number; z: number } {
  const h = ctx.layout.houses.find((h) => h.id === npc.homeId);
  return h ? { x: h.x, z: h.z } : { x: 0, z: 0 };
}

function randomPointInBounds(ctx: BehaviorContext): { x: number; z: number } {
  const b = ctx.layout.bounds;
  return { x: ctx.rng.range(b.minX * 0.7, b.maxX * 0.7), z: ctx.rng.range(b.minZ * 0.7, b.maxZ * 0.7) };
}

function bestFriendId(ctx: BehaviorContext, npc: Npc): string | null {
  const row = ctx.relationships.rowFor(npc.id);
  let bestId: string | null = null;
  let bestScore = 25; // 最低ラインを超えないと「会いに行きたい」とは思わない
  for (const [id, edge] of row) {
    const score = edge.affection + edge.romance * 0.5 - edge.grudge * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

function setDestination(npc: Npc, x: number, z: number, poiId: string | null): void {
  npc.destination = { x, z };
  npc.destinationPoiId = poiId;
}

export function chooseNextActivity(npc: Npc, ctx: BehaviorContext): void {
  const night = isNight(ctx.tick);
  const hour = hourOfTick(ctx.tick);
  const n = npc.needs;
  const p = npc.personality;

  const wSleep = (night ? 1.6 : 0.15) * (n.fatigue > 55 ? n.fatigue * 1.6 : n.fatigue * 0.4);
  const wEat = n.hunger > 55 ? n.hunger * 1.8 : n.hunger * 0.5;
  const friendId = bestFriendId(ctx, npc);
  const wVisit = friendId && !night ? n.loneliness * (0.4 + p.sociability / 130) : 0;
  const wPlaza = !night ? (n.social * 0.8 + n.fun * 0.3) * (0.3 + p.sociability / 120) * (1 - p.timidity / 220) : n.social * 0.1;
  const wStroll = (n.fun * (0.4 + p.curiosity / 150)) * (night ? 0.35 : 1);
  const wField = !night && hour > 7 && hour < 18 ? p.greed * 0.35 : 0;
  const wBench = !night ? n.fatigue * 0.25 : 0.05;
  const wHomeIdle = 6 + p.timidity * 0.25 + (night ? 20 : 0);

  type Choice = { key: string; weight: number };
  const choices: Choice[] = [
    { key: 'sleep', weight: wSleep },
    { key: 'eat', weight: wEat },
    { key: 'visit', weight: wVisit },
    { key: 'plaza', weight: wPlaza },
    { key: 'stroll', weight: wStroll },
    { key: 'field', weight: wField },
    { key: 'bench', weight: wBench },
    { key: 'home_idle', weight: wHomeIdle },
  ].filter((c) => c.weight > 0);

  const totalWeight = choices.reduce((s, c) => s + c.weight, 0);
  let r = ctx.rng.next() * totalWeight;
  let picked = choices[choices.length - 1]?.key ?? 'home_idle';
  for (const c of choices) {
    r -= c.weight;
    if (r <= 0) {
      picked = c.key;
      break;
    }
  }

  const home = npcHouse(ctx, npc);

  npc.activityTargetNpcId = null;

  switch (picked) {
    case 'sleep': {
      setDestination(npc, home.x + ctx.rng.range(-0.6, 0.6), home.z + ctx.rng.range(-0.6, 0.6), npc.homeId);
      npc.activity = 'sleeping';
      const sleepMinutes = Math.max(120, n.fatigue * 6);
      npc.dwellUntilTick = ctx.tick + sleepMinutes;
      break;
    }
    case 'eat': {
      setDestination(npc, home.x + ctx.rng.range(-0.6, 0.6), home.z + ctx.rng.range(-0.6, 0.6), npc.homeId);
      npc.activity = 'eating';
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(15, 30);
      break;
    }
    case 'visit': {
      const friend = ctx.npcs.find((x) => x.id === friendId);
      const pos = friend ? friend.position : randomPointInBounds(ctx);
      setDestination(npc, pos.x + ctx.rng.range(-1.2, 1.2), pos.z + ctx.rng.range(-1.2, 1.2), null);
      npc.activity = 'visiting';
      npc.activityTargetNpcId = friendId;
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(CONFIG.movement.dwellMinMinutes, CONFIG.movement.dwellMaxMinutes);
      break;
    }
    case 'plaza': {
      const angle = ctx.rng.range(0, Math.PI * 2);
      const r2 = ctx.rng.range(0.5, ctx.layout.plaza.radius - 1);
      setDestination(npc, ctx.layout.plaza.x + Math.cos(angle) * r2, ctx.layout.plaza.z + Math.sin(angle) * r2, 'plaza');
      npc.activity = 'at_plaza';
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(CONFIG.movement.dwellMinMinutes, CONFIG.movement.dwellMaxMinutes);
      break;
    }
    case 'stroll': {
      const pt = randomPointInBounds(ctx);
      setDestination(npc, pt.x, pt.z, null);
      npc.activity = 'strolling';
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(4, 14);
      recoverFunWalk(npc);
      break;
    }
    case 'field': {
      const f = ctx.rng.pick(ctx.layout.fields);
      setDestination(npc, f.x + ctx.rng.range(-f.width / 3, f.width / 3), f.z + ctx.rng.range(-f.depth / 3, f.depth / 3), f.id);
      npc.activity = 'farming';
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(15, 40);
      break;
    }
    case 'bench': {
      const b = ctx.rng.pick(ctx.layout.benches);
      setDestination(npc, b.x, b.z, b.id);
      npc.activity = 'sitting';
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(10, 25);
      break;
    }
    default: {
      setDestination(npc, home.x + ctx.rng.range(-1.5, 1.5), home.z + ctx.rng.range(-1.5, 1.5), npc.homeId);
      npc.activity = 'idle';
      npc.dwellUntilTick = ctx.tick + ctx.rng.range(10, 25);
      break;
    }
  }
}
