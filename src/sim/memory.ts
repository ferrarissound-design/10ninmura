import { CONFIG } from '../config';
import type { Npc } from '../npc/Npc';
import type { MemoryEntry, MemoryType, NpcId } from '../types';

let counter = 0;

export function addMemory(
  npc: Npc,
  tick: number,
  type: MemoryType,
  aboutId: NpcId,
  weight: number,
  text: string,
  extraId?: NpcId,
  fromRumor?: boolean,
): void {
  const entry: MemoryEntry = {
    id: `mem_${counter++}`,
    tick,
    type,
    aboutId,
    extraId,
    weight,
    isMajor: weight >= CONFIG.memory.majorWeightThreshold,
    text,
    fromRumor,
  };
  npc.memory.push(entry);
  if (npc.memory.length > CONFIG.memory.maxEntries * 1.5) {
    npc.memory.sort((a, b) => b.weight - a.weight);
    npc.memory.length = Math.floor(CONFIG.memory.maxEntries * 1.5);
    npc.memory.sort((a, b) => a.tick - b.tick);
  }
}

// 1ゲーム内「日」ごとに呼ばれる想定の減衰処理
export function decayMemories(npc: Npc): void {
  npc.memory = npc.memory
    .map((m) => {
      const rate = m.isMajor ? CONFIG.memory.majorDecayPerDay : CONFIG.memory.decayPerDay;
      return { ...m, weight: m.weight * (1 - rate) };
    })
    .filter((m) => m.weight >= CONFIG.memory.forgetThreshold)
    .slice(-CONFIG.memory.maxEntries);
}

export function recentMemoriesAbout(npc: Npc, aboutId: NpcId, limit = 5): MemoryEntry[] {
  return npc.memory
    .filter((m) => m.aboutId === aboutId)
    .sort((a, b) => b.tick - a.tick)
    .slice(0, limit);
}
