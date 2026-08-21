import { CONFIG } from '../config';
import type { Npc } from '../npc/Npc';
import type { Rng } from '../rng';
import type { NpcId, VillageIncident, VillageIncidentKind, VillageTestimony, VillageVote } from '../types';
import { addMemory } from './memory';
import type { RelationshipMatrix } from './relationships';

export interface IncidentContext {
  npcs: Npc[];
  relationships: RelationshipMatrix;
  rng: Rng;
  tick: number;
  findNpc: (id: NpcId) => Npc | undefined;
  pushEvent: (text: string, npcIds: NpcId[], major?: boolean) => void;
}

const INCIDENTS: Record<VillageIncidentKind, { title: string; description: string }> = {
  food_theft: { title: '共同倉庫の食料盗難', description: '共同倉庫から冬支度用の食料が消えた。犯人は村人の誰かだ。' },
  field_damage: { title: '畑荒らし事件', description: '夜のうちに共同畑が荒らされた。足跡は村の中へ続いている。' },
  shared_fund_loss: { title: '共同資金の紛失', description: '村の祭りに使う共同資金が箱ごと消えた。鍵を知る者は限られている。' },
};

function pickOther(npcs: Npc[], excluded: Set<NpcId>, rng: Rng): Npc {
  const candidates = npcs.filter((npc) => !excluded.has(npc.id));
  return rng.pick(candidates.length ? candidates : npcs);
}

function testimonyText(witness: Npc, suspect: Npc, kind: VillageIncidentKind, certainty: string): string {
  const place = kind === 'food_theft' ? '倉庫の近く' : kind === 'field_damage' ? '畑の近く' : '集会所の近く';
  return `${witness.name}は「${certainty}${suspect.name}を${place}で見た」と話している`;
}

export function createVillageIncident(ctx: IncidentContext, sequence: number): VillageIncident {
  const kind = ctx.rng.pick(Object.keys(INCIDENTS) as VillageIncidentKind[]);
  const culprit = ctx.rng.weightedPick(
    ctx.npcs.map((npc) => ({ item: npc, weight: 10 + npc.personality.greed * 0.9 + npc.personality.aggression * 0.25 })),
  );
  const available = ctx.rng.shuffle(ctx.npcs.filter((npc) => npc.id !== culprit.id));
  const testimonies: VillageTestimony[] = [];

  for (const witness of available.slice(0, CONFIG.incident.truthfulWitnesses)) {
    testimonies.push({
      id: `testimony_${sequence}_${testimonies.length}`,
      witnessId: witness.id,
      suspectId: culprit.id,
      truth: 'fact',
      reliability: 55 + witness.personality.honesty * 0.4,
      text: testimonyText(witness, culprit, kind, 'たしかに'),
      shared: false,
    });
    addMemory(witness, ctx.tick, 'witnessed_incident', culprit.id, 65, `${culprit.name}が事件現場から離れるのを見た`);
  }

  for (const witness of available.slice(CONFIG.incident.truthfulWitnesses, CONFIG.incident.truthfulWitnesses + CONFIG.incident.mistakenWitnesses)) {
    const suspect = pickOther(ctx.npcs, new Set([witness.id, culprit.id]), ctx.rng);
    testimonies.push({
      id: `testimony_${sequence}_${testimonies.length}`,
      witnessId: witness.id,
      suspectId: suspect.id,
      truth: 'mistake',
      reliability: 25 + witness.personality.honesty * 0.25,
      text: testimonyText(witness, suspect, kind, 'たぶん'),
      shared: false,
    });
    addMemory(witness, ctx.tick, 'witnessed_incident', suspect.id, 38, `${suspect.name}らしき姿を事件現場の近くで見た`);
  }

  const scapegoat = [...ctx.npcs]
    .filter((npc) => npc.id !== culprit.id)
    .sort((a, b) => ctx.relationships.get(culprit.id, a.id).affection - ctx.relationships.get(culprit.id, b.id).affection)[0];
  if (scapegoat) {
    testimonies.push({
      id: `testimony_${sequence}_${testimonies.length}`,
      witnessId: culprit.id,
      suspectId: scapegoat.id,
      truth: 'lie',
      reliability: 20 + (100 - culprit.personality.honesty) * 0.5,
      text: testimonyText(culprit, scapegoat, kind, '間違いなく'),
      shared: false,
    });
  }

  const incident: VillageIncident = {
    id: `incident_${sequence}`,
    kind,
    title: INCIDENTS[kind].title,
    description: INCIDENTS[kind].description,
    culpritId: culprit.id,
    startedTick: ctx.tick,
    meetingTick: ctx.tick + CONFIG.incident.investigationMinutes,
    resolvedTick: null,
    phase: 'investigation',
    testimonies,
    votes: [],
    accusedId: null,
    outcomeText: null,
  };
  ctx.pushEvent(`【事件】${incident.description}`, ctx.npcs.map((npc) => npc.id), true);
  return incident;
}

export function shareNextTestimony(incident: VillageIncident, ctx: IncidentContext): boolean {
  const unshared = incident.testimonies.filter((item) => !item.shared);
  if (!unshared.length) return false;
  const testimony = ctx.rng.weightedPick(
    unshared.map((item) => {
      const witness = ctx.findNpc(item.witnessId)!;
      return { item, weight: 20 + witness.personality.gossipy + witness.personality.honesty * 0.35 };
    }),
  );
  testimony.shared = true;
  const witness = ctx.findNpc(testimony.witnessId)!;
  const suspect = ctx.findNpc(testimony.suspectId)!;
  ctx.pushEvent(`【証言】${testimony.text}`, [witness.id, suspect.id]);
  addMemory(suspect, ctx.tick, 'accused_by', witness.id, 58, `${witness.name}から事件の容疑をかけられた`);
  ctx.relationships.adjustAffection(suspect.id, witness.id, -6);
  ctx.relationships.adjustGrudge(suspect.id, witness.id, 5);

  for (const listener of ctx.npcs) {
    if (listener.id === witness.id || listener.id === suspect.id) continue;
    const witnessTrust = ctx.relationships.get(listener.id, witness.id).trust;
    const influence = Math.max(0.5, (testimony.reliability / 100) * (0.75 + witnessTrust / 200));
    ctx.relationships.adjustTrust(listener.id, suspect.id, -4 * influence);
    addMemory(listener, ctx.tick, 'heard_gossip_about', suspect.id, 18 * influence, `${witness.name}から${suspect.name}への疑いを聞いた`, witness.id, true);
  }
  return true;
}

function chooseVote(voter: Npc, incident: VillageIncident, ctx: IncidentContext): VillageVote {
  const candidates = ctx.npcs.filter((npc) => npc.id !== voter.id);
  const scored = candidates.map((candidate) => {
    let evidence = 0;
    for (const testimony of incident.testimonies.filter((item) => item.shared && item.suspectId === candidate.id)) {
      const witnessTrust = ctx.relationships.get(voter.id, testimony.witnessId).trust;
      evidence += testimony.reliability * (0.65 + witnessTrust / 220);
    }
    const relation = ctx.relationships.get(voter.id, candidate.id);
    const bias = -relation.affection * 0.4 - relation.trust * 0.35 + relation.grudge * 0.5;
    const statusBias = -candidate.socialStatus.reputation * 0.18;
    const culpritDeception =
      voter.id === incident.culpritId &&
      incident.testimonies.some((item) => item.witnessId === voter.id && item.suspectId === candidate.id && item.truth === 'lie')
        ? ctx.rng.range(45, 75)
        : 0;
    const intuition = ctx.rng.range(0, 22);
    const reason = culpritDeception > 0
      ? '自分への疑いをそらそうとした'
      : evidence >= Math.max(Math.abs(bias), Math.abs(statusBias), intuition) && evidence > 8
        ? '公開証言を重く見た'
        : bias >= Math.max(Math.abs(statusBias), intuition) && bias > 8
          ? '日頃の不信や恨みが影響した'
          : statusBias > intuition && statusBias > 5
            ? '村での悪い評判を疑った'
            : '決め手に欠け、直感で選んだ';
    return { candidate, score: evidence + bias + statusBias + culpritDeception + intuition, reason };
  });
  scored.sort((a, b) => b.score - a.score);
  return {
    voterId: voter.id,
    suspectId: scored[0].candidate.id,
    confidence: Math.max(1, scored[0].score),
    reason: scored[0].reason,
  };
}

export function holdVillageMeeting(incident: VillageIncident, ctx: IncidentContext): void {
  incident.phase = 'meeting';
  while (shareNextTestimony(incident, ctx)) {
    // 会議開始時に未公開証言をすべて出す。
  }
  ctx.pushEvent('【村会議】事件の容疑者を決める投票が始まった', ctx.npcs.map((npc) => npc.id), true);
  incident.votes = ctx.npcs.map((npc) => chooseVote(npc, incident, ctx));

  const counts = new Map<NpcId, number>();
  for (const vote of incident.votes) {
    const voter = ctx.findNpc(vote.voterId)!;
    const weight = voter.socialStatus.roles.includes('mayor') ? 1.5 : 1;
    counts.set(vote.suspectId, (counts.get(vote.suspectId) ?? 0) + weight);
  }
  const accusedId = [...counts.entries()].sort((a, b) => b[1] - a[1] || ctx.rng.next() - 0.5)[0][0];
  incident.accusedId = accusedId;
  const accused = ctx.findNpc(accusedId)!;
  const votersAgainst = incident.votes.filter((vote) => vote.suspectId === accusedId);

  for (const vote of votersAgainst) {
    const voter = ctx.findNpc(vote.voterId)!;
    addMemory(accused, ctx.tick, 'voted_against', voter.id, 58, `${voter.name}が自分を犯人だと投票した`);
    ctx.relationships.adjustAffection(accused.id, voter.id, -7);
    ctx.relationships.adjustGrudge(accused.id, voter.id, 9);
  }

  const defender = ctx.npcs
    .filter((npc) => npc.id !== accused.id && !votersAgainst.some((vote) => vote.voterId === npc.id))
    .sort((a, b) => ctx.relationships.get(accused.id, b.id).affection - ctx.relationships.get(accused.id, a.id).affection)[0];
  if (defender) {
    addMemory(accused, ctx.tick, 'defended_by', defender.id, 60, `${defender.name}だけは自分を犯人扱いしなかった`);
    ctx.relationships.adjustTrust(accused.id, defender.id, 8);
  }

  const culprit = ctx.findNpc(incident.culpritId)!;
  const correct = accused.id === culprit.id;
  for (const villager of ctx.npcs) {
    if (villager.id === culprit.id) continue;
    ctx.relationships.adjustAffection(villager.id, culprit.id, -12);
    ctx.relationships.adjustTrust(villager.id, culprit.id, -10);
    ctx.relationships.adjustGrudge(villager.id, culprit.id, 6);
  }
  for (const testimony of incident.testimonies) {
    for (const listener of ctx.npcs) {
      if (listener.id === testimony.witnessId) continue;
      const truthDelta = testimony.truth === 'fact' ? 4 : testimony.truth === 'lie' ? -12 : -3;
      ctx.relationships.adjustTrust(listener.id, testimony.witnessId, truthDelta);
    }
  }
  if (correct) {
    culprit.socialStatus.reputation = Math.max(-100, culprit.socialStatus.reputation - 35);
    incident.outcomeText = `${accused.name}が犯人だと判明した。村の疑いは正しかった。`;
  } else {
    accused.socialStatus.reputation = Math.max(-100, accused.socialStatus.reputation - 15);
    culprit.socialStatus.reputation = Math.max(-100, culprit.socialStatus.reputation - 30);
    addMemory(accused, ctx.tick, 'wrongly_accused', culprit.id, 95, `無実なのに犯人扱いされた。本当の犯人は${culprit.name}だった`);
    incident.outcomeText = `${accused.name}は無実だった。後に本当の犯人が${culprit.name}だと判明した。`;
  }
  incident.phase = 'resolved';
  incident.resolvedTick = ctx.tick;
  ctx.pushEvent(`【決着】${incident.outcomeText}`, [accused.id, culprit.id], true);
}
