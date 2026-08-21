import { CONFIG } from '../config';
import { addMemory } from './memory';
import type { Npc } from '../npc/Npc';
import { recoverSocial } from './needs';
import type { BehaviorContext } from './behavior';
import type { InteractionKind, MemoryEntry, MemoryType, NpcId, RumorContent } from '../types';

export interface InteractionDeps extends BehaviorContext {
  pushEvent: (text: string, npcIds: NpcId[], major?: boolean) => void;
  findNpc: (id: NpcId) => Npc | undefined;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function say(npc: Npc, text: string, ctx: InteractionDeps, major = false): void {
  npc.currentSpeech = {
    text,
    untilRealMs: performance.now() + CONFIG.interaction.speechBubbleSeconds * 1000,
    kind: major ? 'major' : 'normal',
  };
}

function pause(npc: Npc, ctx: InteractionDeps, durationMinutes: number): void {
  npc.pausedActivity = npc.activity;
  npc.pausedDestination = npc.destination;
  npc.pausedDestinationPoiId = npc.destinationPoiId;
  npc.pausedActivityStarted = npc.activityStarted;
  npc.pausedDwellRemainingMinutes = npc.activityStarted ? Math.max(0, npc.dwellUntilTick - ctx.tick) : 0;
  npc.activity = 'interacting';
  npc.destination = null;
  npc.interactionEndTick = ctx.tick + durationMinutes;
}

function eventSentiment(type: MemoryType): number {
  switch (type) {
    case 'complimented_by':
    case 'helped_by':
    case 'gift_from':
      return 1;
    case 'cheerful_chat_with':
      return 0.6;
    case 'apologized_by':
      return 0.5;
    case 'confessed_by':
      return 0.3;
    case 'started_dating':
      return 0.4;
    case 'broken_up_with':
      return -0.4;
    case 'rejected_by':
      return -0.3;
    case 'insulted_by':
      return -1;
    case 'argued_with':
      return -0.9;
    case 'fought_with':
      return -1.5;
    case 'betrayed_by':
      return -1.7;
    case 'rival_approached_crush':
      return -0.7;
    case 'heard_gossip_about':
      return 0;
    default:
      return 0;
  }
}

const ESCALATION_MAP: Partial<Record<MemoryType, MemoryType>> = {
  argued_with: 'fought_with',
  insulted_by: 'betrayed_by',
  complimented_by: 'confessed_by',
  cheerful_chat_with: 'gift_from',
};

function chooseSpeaker(a: Npc, b: Npc, ctx: InteractionDeps): [Npc, Npc] {
  const scoreA = a.personality.sociability * 0.5 + a.personality.curiosity * 0.3 + ctx.rng.next() * 30;
  const scoreB = b.personality.sociability * 0.5 + b.personality.curiosity * 0.3 + ctx.rng.next() * 30;
  return scoreA >= scoreB ? [a, b] : [b, a];
}

// ---- 直接交流(相手本人に対する行動)の選択 ----

function pickDirectKind(speaker: Npc, listener: Npc, ctx: InteractionDeps): InteractionKind {
  const e = ctx.relationships.get(speaker.id, listener.id);
  const back = ctx.relationships.get(listener.id, speaker.id);
  const p = speaker.personality;

  const hostileMood = Math.max(0, -e.affection) + e.grudge * 0.8 + e.jealousy * 0.6;
  const warmMood = Math.max(0, e.affection);

  const weights: { key: InteractionKind; weight: number }[] = [
    { key: 'greet', weight: 9 },
    { key: 'chat', weight: 16 + p.sociability * 0.22 - hostileMood * 0.15 },
    { key: 'compliment', weight: p.kindness * 0.32 + warmMood * 0.12 - p.timidity * 0.08 },
    { key: 'joke', weight: ((p.sociability + p.curiosity) / 2) * 0.22 * (e.affection > -15 ? 1 : 0.3) },
    {
      key: 'gift',
      weight: Math.max(0, p.kindness * 0.08 + e.romance * 0.22 - p.greed * 0.08) * (warmMood > 10 ? 1 : 0.25),
    },
    {
      key: 'apologize',
      weight: (e.grudge > 12 || back.grudge > 12) ? p.honesty * 0.28 + p.kindness * 0.2 : 0,
    },
    {
      key: 'argue',
      weight: Math.max(0, p.aggression * 0.3 + hostileMood * 0.35 - p.timidity * 0.2),
    },
    {
      key: 'fight',
      weight:
        p.aggression > 55 && e.affection < -35
          ? p.aggression * 0.14 + e.grudge * 0.22 + e.jealousy * 0.18
          : 0,
    },
  ];

  const total = weights.reduce((s, w) => s + Math.max(0, w.weight), 0);
  let r = ctx.rng.next() * total;
  for (const w of weights) {
    r -= Math.max(0, w.weight);
    if (r <= 0) return w.key;
  }
  return 'chat';
}

const GREET_LINES = ['やあ', 'おはよう', 'こんにちは', 'よっ', 'また会ったね'];
const CHAT_LINES = ['いい天気だね', '最近どう？', 'お腹すいたなあ', '今日は疲れたよ', 'この村、平和だね'];
const COMPLIMENT_LINES = ['その服いいね', '今日も元気だね', '君といると楽しいよ', 'すごいなあ、尊敬する'];
const JOKE_LINES = ['なぞなぞ好き？', 'さっき変な夢見たんだ', 'ねえねえ、聞いて聞いて'];
const GIFT_LINES = ['これ、あげる', 'お土産だよ', 'よかったらどうぞ'];
const APOLOGIZE_LINES = ['この前はごめん', 'ごめんね、言い過ぎた', '仲直りしよう？'];
const ARGUE_LINES = ['お前ちょっとムカつく', 'それはどうかと思う', 'いい加減にしてよ'];
const FIGHT_LINES = ['もう我慢の限界だ！', 'いいかげんにしろよ！', 'お前とはやってられない！'];
const CONFESS_LINES = ['好きです', 'ずっと想ってた', '付き合ってください'];

function applyDirect(kind: InteractionKind, speaker: Npc, listener: Npc, ctx: InteractionDeps): void {
  const d = CONFIG.relationship.deltas;
  switch (kind) {
    case 'greet': {
      say(speaker, ctx.rng.pick(GREET_LINES), ctx);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.greet);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.greet * 0.6);
      break;
    }
    case 'chat': {
      say(speaker, ctx.rng.pick(CHAT_LINES), ctx);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.chat);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.chat * 0.8);
      recoverSocial(speaker);
      recoverSocial(listener);
      addMemory(listener, ctx.tick, 'cheerful_chat_with', speaker.id, 14, `${speaker.name}と雑談した`);
      ctx.pushEvent(`${speaker.name}と${listener.name}が雑談した`, [speaker.id, listener.id]);
      break;
    }
    case 'compliment': {
      say(speaker, ctx.rng.pick(COMPLIMENT_LINES), ctx);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.compliment * 0.4);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.compliment);
      recoverSocial(listener);
      addMemory(listener, ctx.tick, 'complimented_by', speaker.id, 30, `${speaker.name}に褒められた`);
      ctx.pushEvent(`${speaker.name}が${listener.name}を褒めた`, [speaker.id, listener.id]);
      checkJealousWitnesses(speaker, listener, ctx);
      break;
    }
    case 'joke': {
      say(speaker, ctx.rng.pick(JOKE_LINES), ctx);
      const landed = ctx.rng.bool(0.5 + speaker.personality.sociability / 300);
      const delta = landed ? d.joke : -2;
      ctx.relationships.adjustAffection(speaker.id, listener.id, delta * 0.5);
      ctx.relationships.adjustAffection(listener.id, speaker.id, delta);
      break;
    }
    case 'gift': {
      say(speaker, ctx.rng.pick(GIFT_LINES), ctx, true);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.gift * 0.3);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.gift);
      ctx.relationships.adjustTrust(listener.id, speaker.id, d.gift * 0.4);
      addMemory(listener, ctx.tick, 'gift_from', speaker.id, 45, `${speaker.name}にプレゼントをもらった`, undefined);
      ctx.pushEvent(`${speaker.name}が${listener.name}にプレゼントを渡した`, [speaker.id, listener.id], true);
      checkJealousWitnesses(speaker, listener, ctx);
      break;
    }
    case 'apologize': {
      say(speaker, ctx.rng.pick(APOLOGIZE_LINES), ctx);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.apologize_recover * 0.5);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.apologize_recover);
      ctx.relationships.adjustGrudge(listener.id, speaker.id, -18);
      ctx.relationships.adjustGrudge(speaker.id, listener.id, -10);
      addMemory(listener, ctx.tick, 'apologized_by', speaker.id, 20, `${speaker.name}に謝られた`);
      ctx.pushEvent(`${speaker.name}が${listener.name}に謝った`, [speaker.id, listener.id]);
      break;
    }
    case 'argue': {
      say(speaker, ctx.rng.pick(ARGUE_LINES), ctx, true);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.argue * 0.6);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.argue);
      ctx.relationships.adjustGrudge(listener.id, speaker.id, 14);
      ctx.relationships.adjustGrudge(speaker.id, listener.id, 8);
      addMemory(listener, ctx.tick, 'argued_with', speaker.id, 40, `${speaker.name}と口論した`);
      addMemory(speaker, ctx.tick, 'argued_with', listener.id, 30, `${listener.name}と口論した`);
      ctx.pushEvent(`${speaker.name}と${listener.name}が口論した`, [speaker.id, listener.id], true);
      break;
    }
    case 'fight': {
      say(speaker, ctx.rng.pick(FIGHT_LINES), ctx, true);
      ctx.relationships.adjustAffection(speaker.id, listener.id, d.fight * 0.7);
      ctx.relationships.adjustAffection(listener.id, speaker.id, d.fight);
      ctx.relationships.adjustGrudge(listener.id, speaker.id, 32);
      ctx.relationships.adjustGrudge(speaker.id, listener.id, 22);
      addMemory(listener, ctx.tick, 'fought_with', speaker.id, 70, `${speaker.name}と喧嘩した`);
      addMemory(speaker, ctx.tick, 'fought_with', listener.id, 55, `${listener.name}と喧嘩した`);
      ctx.pushEvent(`${speaker.name}と${listener.name}が喧嘩した！`, [speaker.id, listener.id], true);
      break;
    }
    default:
      break;
  }
}

// ---- 噂・悪口(第三者についての会話) ----

function eligibleGossipMemories(speaker: Npc, listener: Npc): MemoryEntry[] {
  // heard_gossip_about も再度伝えてよい(伝聞の連鎖=噂が村に広がっていく)。
  // ただし weight は伝聞のたびに hearImpressionScale で減衰していくので自然に収束する。
  return speaker.memory.filter((m) => m.aboutId !== listener.id && m.aboutId !== speaker.id && m.weight >= 10);
}

function tryGossip(speaker: Npc, listener: Npc, ctx: InteractionDeps): boolean {
  const gossipChance = clamp01(speaker.personality.gossipy / 130) * CONFIG.rumor.maxShareChance;
  const pool = eligibleGossipMemories(speaker, listener);
  if (pool.length === 0) return false;
  if (!ctx.rng.bool(gossipChance)) return false;

  const chosen = ctx.rng.weightedPick(
    pool.map((m) => ({ item: m, weight: m.weight + (m.isMajor ? 40 : 0) + ctx.rng.next() * 10 })),
  );

  const subject = ctx.findNpc(chosen.aboutId);
  if (!subject) return false;

  let type = chosen.rumor?.sourceType ?? chosen.type;
  let intensity = chosen.rumor?.intensity ?? chosen.weight;
  let distortedThisHop = false;
  if (ctx.rng.bool(CONFIG.rumor.distortionChance)) {
    distortedThisHop = true;
    intensity = Math.min(100, intensity * CONFIG.rumor.exaggerationFactor);
    const escalated = ESCALATION_MAP[type];
    if (escalated && ctx.rng.bool(0.5)) type = escalated;
  }

  const sentiment = eventSentiment(type);
  const negative = sentiment < 0;

  const listenerHeardWeight = Math.max(
    CONFIG.rumor.maxHopWeightFloor * 10,
    intensity * CONFIG.rumor.hearImpressionScale,
  );

  const verb = describeMemoryTypeForRumor(type);
  const text = negative
    ? `${subject.name}が${verb}らしいよ…`
    : `聞いた？${subject.name}が${verb}んだって`;
  const distorted = (chosen.rumor?.distorted ?? false) || distortedThisHop;
  say(speaker, distortedThisHop ? text + '(という噂)' : text, ctx, chosen.isMajor);

  const rumor: RumorContent = {
    id: chosen.rumor?.id ?? `rumor_${chosen.id}`,
    subjectId: subject.id,
    sourceType: type,
    originTick: chosen.rumor?.originTick ?? chosen.tick,
    distorted,
    intensity: listenerHeardWeight,
    hops: (chosen.rumor?.hops ?? 0) + 1,
  };

  addMemory(
    listener,
    ctx.tick,
    'heard_gossip_about',
    subject.id,
    listenerHeardWeight,
    `${speaker.name}から${subject.name}の噂を聞いた`,
    speaker.id,
    true,
    rumor,
  );

  const rumorDelta = negative
    ? CONFIG.relationship.deltas.rumor_negative
    : CONFIG.relationship.deltas.rumor_positive;
  const affectionDelta = rumorDelta * Math.max(0.25, Math.abs(sentiment)) * (intensity / 100) * CONFIG.rumor.hearImpressionScale;
  ctx.relationships.adjustAffection(listener.id, subject.id, affectionDelta);
  if (negative) ctx.relationships.adjustGrudge(listener.id, subject.id, Math.abs(affectionDelta) * 0.5);

  // 噂話をすること自体が話し手と聞き手の距離を縮める(共犯関係)
  ctx.relationships.adjustAffection(listener.id, speaker.id, 3);
  ctx.relationships.adjustTrust(listener.id, speaker.id, 3);

  ctx.pushEvent(`${listener.name}が${subject.name}の噂を聞いた`, [speaker.id, listener.id, subject.id]);
  return true;
}

function describeMemoryTypeForRumor(type: MemoryType): string {
  switch (type) {
    case 'insulted_by':
      return '誰かの悪口を言っていた';
    case 'fought_with':
      return '誰かと喧嘩した';
    case 'argued_with':
      return '誰かと口論した';
    case 'betrayed_by':
      return '誰かを裏切った';
    case 'rival_approached_crush':
      return '誰かの恋人にちょっかいを出した';
    case 'complimented_by':
      return '誰かに優しくしていた';
    case 'helped_by':
      return '誰かを助けていた';
    case 'gift_from':
      return 'プレゼントを渡していた';
    case 'started_dating':
      return '誰かと付き合い始めた';
    case 'confessed_by':
      return '誰かに告白していた';
    case 'broken_up_with':
      return '誰かと別れた';
    case 'apologized_by':
      return '誰かに謝っていた';
    case 'cheerful_chat_with':
      return '誰かと楽しそうに話していた';
    default:
      return '何かあったらしい';
  }
}

// ---- 恋愛: 告白 ----

function tryConfess(speaker: Npc, listener: Npc, ctx: InteractionDeps): boolean {
  if (speaker.romance.stage !== 'crush' || speaker.romance.targetId !== listener.id) return false;
  const e = ctx.relationships.get(speaker.id, listener.id);
  if (e.romance < CONFIG.romance.confessReadiness) return false;

  const timidFactor = 1 - speaker.personality.timidity / 160;
  const chance = CONFIG.romance.confessBaseChance * (1 + speaker.personality.romanceDrive / 45) * Math.max(0.15, timidFactor);
  if (!ctx.rng.bool(chance)) return false;

  say(speaker, ctx.rng.pick(CONFESS_LINES), ctx, true);

  const back = ctx.relationships.get(listener.id, speaker.id);
  const alreadyTaken = listener.romance.stage === 'dating';
  let acceptScore = back.affection * 0.6 + back.romance * 0.7 + listener.personality.romanceDrive * 0.1;
  if (alreadyTaken) acceptScore -= 90;
  const acceptChance = clamp01((acceptScore + 20) / 140);

  if (ctx.rng.bool(acceptChance)) {
    speaker.romance = { stage: 'dating', targetId: listener.id, since: ctx.tick, exIds: speaker.romance.exIds };
    listener.romance = { stage: 'dating', targetId: speaker.id, since: ctx.tick, exIds: listener.romance.exIds };
    ctx.relationships.adjustAffection(speaker.id, listener.id, CONFIG.relationship.deltas.confess_success_affection);
    ctx.relationships.adjustAffection(listener.id, speaker.id, CONFIG.relationship.deltas.confess_success_affection);
    ctx.relationships.adjustRomance(listener.id, speaker.id, 25);
    addMemory(speaker, ctx.tick, 'started_dating', listener.id, 90, `${listener.name}と付き合い始めた`);
    addMemory(listener, ctx.tick, 'started_dating', speaker.id, 90, `${speaker.name}と付き合い始めた`);
    ctx.pushEvent(`${speaker.name}が${listener.name}に告白し、付き合い始めた！`, [speaker.id, listener.id], true);
  } else {
    addMemory(speaker, ctx.tick, 'rejected_by', listener.id, 60, `${listener.name}に告白してフラれた`);
    addMemory(listener, ctx.tick, 'confessed_by', speaker.id, 35, `${speaker.name}に告白された`);
    ctx.relationships.adjustAffection(speaker.id, listener.id, -8);
    speaker.romance = { stage: 'none', targetId: null, since: ctx.tick, exIds: speaker.romance.exIds };
    ctx.pushEvent(`${speaker.name}が${listener.name}に告白したが、フラれた`, [speaker.id, listener.id], true);
  }
  return true;
}

// ---- 嫉妬: 目撃処理 ----

function checkJealousWitnesses(actor: Npc, target: Npc, ctx: InteractionDeps): void {
  const noticeRadiusSq = 8 * 8;
  for (const witness of ctx.npcs) {
    if (witness.id === actor.id || witness.id === target.id) continue;
    const isInvested =
      (witness.romance.targetId === target.id && (witness.romance.stage === 'crush' || witness.romance.stage === 'dating')) ||
      (witness.romance.targetId === actor.id && (witness.romance.stage === 'crush' || witness.romance.stage === 'dating'));
    if (!isInvested) continue;
    const dx = witness.position.x - target.position.x;
    const dz = witness.position.z - target.position.z;
    if (dx * dx + dz * dz > noticeRadiusSq) continue;

    const rivalId = witness.romance.targetId === target.id ? actor.id : target.id;
    const belovedId = witness.romance.targetId === target.id ? target.id : actor.id;
    const gain = CONFIG.romance.jealousyGainOnRivalCloseness * (0.4 + witness.personality.jealousy / 90);
    ctx.relationships.adjustJealousy(witness.id, rivalId, gain);
    ctx.relationships.adjustAffection(witness.id, rivalId, -gain * 0.3);
    addMemory(
      witness,
      ctx.tick,
      'rival_approached_crush',
      rivalId,
      35,
      `${rivalId === actor.id ? actor.name : target.name}が${ctx.findNpc(belovedId)?.name ?? ''}に近づいていて嫉妬した`,
      belovedId,
    );
    const jEdge = ctx.relationships.get(witness.id, rivalId);
    if (jEdge.jealousy > CONFIG.romance.jealousyHostilityThreshold) {
      ctx.pushEvent(`${witness.name}が少し嫉妬した`, [witness.id, rivalId, belovedId]);
    }
  }
}

// ---- メインエントリーポイント ----

export function tryInteraction(a: Npc, b: Npc, ctx: InteractionDeps): boolean {
  if (a.activity === 'interacting' || b.activity === 'interacting') return false;
  if ((a.activity === 'sleeping' && a.activityStarted) || (b.activity === 'sleeping' && b.activityStarted)) return false;

  const lastA = a.lastInteractionTick.get(b.id) ?? -Infinity;
  if (ctx.tick - lastA < CONFIG.interaction.cooldownMinutes) return false;

  const [speaker, listener] = chooseSpeaker(a, b, ctx);

  if (tryConfess(speaker, listener, ctx) || tryConfess(listener, speaker, ctx)) {
    finalize(a, b, ctx);
    return true;
  }

  if (tryGossip(speaker, listener, ctx)) {
    finalize(a, b, ctx);
    return true;
  }

  const kind = pickDirectKind(speaker, listener, ctx);
  applyDirect(kind, speaker, listener, ctx);

  if (kind === 'argue' || kind === 'fight') {
    checkJealousWitnesses(speaker, listener, ctx);
  }

  finalize(a, b, ctx);
  return true;
}

function finalize(a: Npc, b: Npc, ctx: InteractionDeps): void {
  const dur = 1.2 + ctx.rng.range(0.5, 2.2);
  pause(a, ctx, dur);
  pause(b, ctx, dur);
  a.lastInteractionTick.set(b.id, ctx.tick);
  b.lastInteractionTick.set(a.id, ctx.tick);
}
