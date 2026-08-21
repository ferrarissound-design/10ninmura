import type { Rng } from '../rng';
import type { Npc } from '../npc/Npc';
import type { RelationshipMatrix } from './relationships';
import { addMemory } from './memory';

// ゲーム開始時に少しだけ関係性の種を入れる。
// 完全ランダムだと何も起きるまでに時間がかかりすぎるため、
// 「幼馴染」「片思い」「少し苦手な相手」「仲良しグループ」を1つずつ用意する。
// 内容(誰と誰か)は村を作るたびにランダムに変わる。
export function seedInitialRelationships(npcs: Npc[], relationships: RelationshipMatrix, rng: Rng, tick: number): void {
  const pool = rng.shuffle(npcs);

  // 幼馴染ペア
  const [child1, child2] = pool;
  if (child1 && child2) {
    relationships.adjustAffection(child1.id, child2.id, 58);
    relationships.adjustAffection(child2.id, child1.id, 58);
    relationships.adjustTrust(child1.id, child2.id, 40);
    relationships.adjustTrust(child2.id, child1.id, 40);
    addMemory(child1, tick, 'cheerful_chat_with', child2.id, 70, `${child2.name}とは幼馴染だ`);
    addMemory(child2, tick, 'cheerful_chat_with', child1.id, 70, `${child1.name}とは幼馴染だ`);
  }

  // 片思い(秘密の想い)
  const crushPair = pool.filter((n) => n !== child1 && n !== child2);
  const admirer = crushPair[0];
  const crushTarget = crushPair[1] ?? pool[2];
  if (admirer && crushTarget) {
    admirer.romance = { stage: 'crush', targetId: crushTarget.id, since: tick, exIds: [] };
    relationships.adjustAffection(admirer.id, crushTarget.id, 32);
    relationships.adjustRomance(admirer.id, crushTarget.id, 38);
    addMemory(admirer, tick, 'cheerful_chat_with', crushTarget.id, 40, `${crushTarget.name}のことが気になっている`);
  }

  // 少し苦手な相手
  const dislikePair = rng.shuffle(pool.filter((n) => n !== admirer && n !== crushTarget));
  const disliker = dislikePair[0];
  const disliked = dislikePair[1];
  if (disliker && disliked) {
    relationships.adjustAffection(disliker.id, disliked.id, -26);
    relationships.adjustGrudge(disliker.id, disliked.id, 12);
    addMemory(disliker, tick, 'argued_with', disliked.id, 30, `${disliked.name}とはどうも馬が合わない`);
  }

  // 仲良しグループ(3人)
  const groupCandidates = rng.shuffle(pool.filter((n) => n !== disliker && n !== disliked));
  const group = groupCandidates.slice(0, 3);
  for (let i = 0; i < group.length; i++) {
    for (let j = 0; j < group.length; j++) {
      if (i === j) continue;
      relationships.adjustAffection(group[i].id, group[j].id, 34);
      relationships.adjustTrust(group[i].id, group[j].id, 22);
    }
  }
  if (group.length === 3) {
    for (const g of group) {
      const others = group.filter((x) => x !== g);
      addMemory(g, tick, 'cheerful_chat_with', others[0].id, 35, `${others[0].name}や${others[1].name}とはよく一緒にいる`);
    }
  }
}
