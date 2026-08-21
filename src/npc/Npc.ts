import type { Rng } from '../rng';
import { CONFIG } from '../config';
import type {
  ActivityKind,
  Gender,
  MemoryEntry,
  Needs,
  NpcId,
  PersonalityTraits,
  RomanceState,
  SocialStatus,
} from '../types';
import { pickName } from './names';

export interface NpcAppearance {
  bodyColor: number;
  hairColor: number;
  accentColor: number; // 服の差し色
  hairStyle: 'short' | 'long' | 'bun' | 'spiky' | 'bald';
  height: number;
}

const HAIR_COLORS = [0x2b1b12, 0x000000, 0x5a3825, 0x7a5230, 0xd6b370, 0xaa4433, 0x333333, 0x8a5fc2];
const BODY_COLORS = [
  0xe07a5f, 0x3d5a80, 0x81b29a, 0xf2cc8f, 0xb5838d, 0x6d6875, 0xffb4a2, 0x4a7c59, 0xe9c46a, 0x577590,
  0xc1666b, 0x48639c,
];
const ACCENT_COLORS = [0xffffff, 0xf4a261, 0x264653, 0xe76f51, 0x2a9d8f, 0x8ecae6, 0xffe066];

function randTrait(rng: Rng): number {
  // ある程度中央にも寄りつつ極端な個性も出るように、2つの一様乱数の平均で軽い正規分布近似
  const a = rng.range(CONFIG.personality.min, CONFIG.personality.max);
  const b = rng.range(CONFIG.personality.min, CONFIG.personality.max);
  return Math.round((a + b) / 2);
}

function generatePersonality(rng: Rng): PersonalityTraits {
  return {
    sociability: randTrait(rng),
    aggression: randTrait(rng),
    kindness: randTrait(rng),
    jealousy: randTrait(rng),
    romanceDrive: randTrait(rng),
    timidity: randTrait(rng),
    honesty: randTrait(rng),
    greed: randTrait(rng),
    curiosity: randTrait(rng),
    gossipy: randTrait(rng),
  };
}

function generateAppearance(rng: Rng, usedBodyColors: Set<number>): NpcAppearance {
  const available = BODY_COLORS.filter((c) => !usedBodyColors.has(c));
  const bodyColor = available.length > 0 ? rng.pick(available) : rng.pick(BODY_COLORS);
  usedBodyColors.add(bodyColor);
  const styles: NpcAppearance['hairStyle'][] = ['short', 'long', 'bun', 'spiky', 'bald'];
  return {
    bodyColor,
    hairColor: rng.pick(HAIR_COLORS),
    accentColor: rng.pick(ACCENT_COLORS),
    hairStyle: rng.pick(styles),
    height: rng.range(0.92, 1.1),
  };
}

export class Npc {
  id: NpcId;
  name: string;
  gender: Gender;
  personality: PersonalityTraits;
  appearance: NpcAppearance;
  needs: Needs;

  homeId: string = '';
  position: { x: number; z: number } = { x: 0, z: 0 };
  destination: { x: number; z: number } | null = null;
  destinationPoiId: string | null = null;
  facing: number = 0;

  activity: ActivityKind = 'idle';
  activityStarted = false;
  activityDurationMinutes = 0;
  dwellUntilTick: number = 0;
  activityTargetNpcId: NpcId | null = null;

  interactionEndTick: number = 0;
  pausedActivity: ActivityKind | null = null;
  pausedDestination: { x: number; z: number } | null = null;
  pausedDestinationPoiId: string | null = null;
  pausedActivityStarted = false;
  pausedDwellRemainingMinutes = 0;

  memory: MemoryEntry[] = [];
  memorySequence = 0;
  romance: RomanceState = { stage: 'none', targetId: null, since: 0, exIds: [] };
  socialStatus: SocialStatus = { reputation: 0, roles: [] };

  lastInteractionTick: Map<NpcId, number> = new Map();

  currentSpeech: { text: string; untilRealMs: number; kind: 'normal' | 'major' } | null = null;

  constructor(index: number, rng: Rng, usedNames: Set<string>, usedBodyColors: Set<number>) {
    this.id = `npc_${index}`;
    this.gender = rng.bool(0.5) ? 'male' : 'female';
    this.name = pickName(this.gender, usedNames, rng);
    this.personality = generatePersonality(rng);
    this.appearance = generateAppearance(rng, usedBodyColors);
    this.needs = {
      hunger: rng.range(10, 35),
      fatigue: rng.range(5, 30),
      loneliness: rng.range(10, 40),
      fun: rng.range(10, 40),
      social: rng.range(10, 40),
    };
  }

  mostUrgentNeed(): keyof Needs {
    let best: keyof Needs = 'hunger';
    let bestVal = -Infinity;
    for (const key of Object.keys(this.needs) as (keyof Needs)[]) {
      if (this.needs[key] > bestVal) {
        bestVal = this.needs[key];
        best = key;
      }
    }
    return best;
  }

  mood(): number {
    // -100..100 程度の大まかな気分スコア。needsの不満と最近の記憶から算出
    const needScore =
      -(this.needs.hunger + this.needs.fatigue + this.needs.loneliness + this.needs.fun + this.needs.social) / 5;
    const recentMemoryScore = this.memory
      .slice(-8)
      .reduce((sum, m) => sum + moodDeltaForMemory(m.type) * (m.weight / 100), 0);
    return Math.max(-100, Math.min(100, needScore * 0.6 + recentMemoryScore * 6));
  }
}

function moodDeltaForMemory(type: MemoryEntry['type']): number {
  switch (type) {
    case 'complimented_by':
    case 'helped_by':
    case 'gift_from':
    case 'started_dating':
    case 'cheerful_chat_with':
      return 3;
    case 'confessed_by':
      return 2;
    case 'apologized_by':
      return 1.5;
    case 'insulted_by':
    case 'fought_with':
    case 'argued_with':
    case 'betrayed_by':
    case 'rejected_by':
    case 'broken_up_with':
    case 'rival_approached_crush':
      return -3;
    case 'heard_gossip_about':
      return -0.5;
    case 'defended_by':
      return 2;
    case 'witnessed_incident':
    case 'accused_by':
    case 'voted_against':
    case 'wrongly_accused':
      return -2.5;
    default:
      return 0;
  }
}
