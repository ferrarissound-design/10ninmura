export type NpcId = string;

export interface PersonalityTraits {
  sociability: number; // 社交性
  aggression: number; // 攻撃性
  kindness: number; // 優しさ
  jealousy: number; // 嫉妬深さ (性格としての傾向)
  romanceDrive: number; // 恋愛積極性
  timidity: number; // 臆病さ
  honesty: number; // 誠実さ
  greed: number; // 金銭欲
  curiosity: number; // 好奇心
  gossipy: number; // 噂好き度
}

export interface Needs {
  hunger: number; // 0-100 高いほど空腹
  fatigue: number; // 0-100 高いほど疲労
  loneliness: number; // 0-100 高いほど孤独
  fun: number; // 0-100 高いほど娯楽欲求が強い
  social: number; // 0-100 高いほど社交欲求が強い
}

export type ActivityKind =
  | 'idle'
  | 'sleeping'
  | 'eating'
  | 'strolling'
  | 'visiting'
  | 'at_plaza'
  | 'farming'
  | 'sitting'
  | 'interacting';

export type Gender = 'male' | 'female';

export interface RelationshipEdge {
  affection: number; // -100..100 好感度
  trust: number; // -100..100 信頼
  romance: number; // 0..100 恋愛感情
  jealousy: number; // 0..100 このNPCに対する嫉妬(ライバル視)
  grudge: number; // 0..100 恨み
}

export type MemoryType =
  | 'complimented_by'
  | 'insulted_by'
  | 'helped_by'
  | 'gift_from'
  | 'fought_with'
  | 'argued_with'
  | 'apologized_by'
  | 'confessed_by'
  | 'rejected_by'
  | 'started_dating'
  | 'broken_up_with'
  | 'betrayed_by'
  | 'rival_approached_crush'
  | 'heard_gossip_about'
  | 'cheerful_chat_with';

export interface MemoryEntry {
  id: string;
  tick: number; // 発生したゲーム内分(絶対値)
  type: MemoryType;
  aboutId: NpcId; // この記憶が誰についてのものか
  extraId?: NpcId; // 三者目が関わる場合(例: 恋人に近づいた相手)
  weight: number; // 記憶の強さ(重要度) 0-100+
  isMajor: boolean;
  text: string; // 日本語の短い説明
  fromRumor?: boolean;
}

export type RomanceStage = 'none' | 'crush' | 'dating' | 'heartbroken';

export interface RomanceState {
  stage: RomanceStage;
  targetId: NpcId | null; // crush/datingの相手
  since: number; // tick
  exIds: NpcId[];
}

export type InteractionKind =
  | 'greet'
  | 'chat'
  | 'compliment'
  | 'joke'
  | 'gift'
  | 'confess'
  | 'badmouth'
  | 'argue'
  | 'fight'
  | 'apologize'
  | 'gossip';

export interface RumorContent {
  id: string;
  subjectId: NpcId;
  aboutId: NpcId; // 噂の対象(subjectの相手)
  kind:
    | 'bad_mouthed'
    | 'started_dating'
    | 'fought'
    | 'confessed'
    | 'broke_up'
    | 'argued'
    | 'gift_given'
    | 'complimented';
  tick: number;
  distorted: boolean;
  intensity: number; // 0-100 噂の強さ(誇張されると増える)
  hops: number; // 何人を経由したか
}

export interface EventLogEntry {
  id: string;
  tick: number;
  timeLabel: string;
  text: string;
  major: boolean;
  npcIds: NpcId[];
}
