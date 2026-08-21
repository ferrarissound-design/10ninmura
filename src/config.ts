// すべての調整可能な数値パラメータをここに集約する。
// コード中に数値をばら撒かず、ここを見ればゲームバランスが分かるようにする。

export const CONFIG = {
  npc: {
    count: 10,
  },

  time: {
    // ×1速度で「実時間1秒あたり」何ゲーム内分が進むか
    minutesPerRealSecondAtX1: 4,
    dayStartHour: 6, // 村の1日は朝6時から始まる
    nightHourStart: 19,
    nightHourEnd: 5,
  },

  needs: {
    // 1ゲーム内分あたりの変動量 (0-100, 高いほど「満たされていない/強い」)
    hungerPerMinute: 0.045,
    fatiguePerMinute: 0.03,
    lonelinessPerMinute: 0.05,
    funDecayPerMinute: 0.035,
    socialDecayPerMinute: 0.04,
    // 満たされた時の回復量
    eatRecoverAmount: 70,
    sleepRecoverAmount: 90,
    talkLonelinessRecover: 35,
    talkSocialRecover: 30,
    walkFunRecover: 18,
    plazaFunRecover: 12,
    // この値を超えると行動選択の優先度が急上昇する
    urgentThreshold: 70,
  },

  movement: {
    speed: 2.6, // units/sec (ゲーム内分ではなく実秒基準)
    arriveDistance: 0.6,
    dwellMinMinutes: 8,
    dwellMaxMinutes: 40,
  },

  interaction: {
    radius: 3.2, // これより近いNPC同士が交流候補になる
    // 1ゲーム内分ごとに交流を試みる基礎確率(社交性で補正)
    baseChancePerMinute: 0.05,
    cooldownMinutes: 12, // 同じ相手と連続で交流しにくくするクールダウン
    speechBubbleSeconds: 3.2,
  },

  relationship: {
    affectionMin: -100,
    affectionMax: 100,
    romanceMax: 100,
    grudgeMax: 100,
    jealousyMax: 100,
    // 交流結果による変化量のベース値
    deltas: {
      greet: 2,
      chat: 4,
      compliment: 9,
      joke: 6,
      gift: 16,
      confess_success_affection: 20,
      argue: -14,
      fight: -26,
      apologize_recover: 12,
      rumor_positive: 4,
      rumor_negative: -5,
    },
    trustDeltaScale: 0.5, // affectionの変化に対する信頼変化の比率
  },

  memory: {
    maxEntries: 24,
    decayPerDay: 0.06, // 通常記憶は1日ごとにこの割合で重みが減衰
    majorDecayPerDay: 0.015, // 重大事件はゆっくり減衰
    forgetThreshold: 4, // 重みがこれを下回ると記憶から削除
    majorWeightThreshold: 55, // これ以上の重みを持つ記憶は「重大事件」として扱う
  },

  rumor: {
    // 噂好き度に応じて、他人と交流した際に第三者の噂を話す確率の最大値
    maxShareChance: 0.35,
    distortionChance: 0.22, // 噂が歪む確率
    exaggerationFactor: 1.6, // 誇張時の効果倍率
    hearImpressionScale: 0.55, // 直接体験に比べて噂の影響力は弱い
    maxHopWeightFloor: 0.2, // 何度も伝聞されて薄まっても最低限残る影響力
  },

  romance: {
    crushThreshold: 55, // affection+相性がこれを超えると恋愛感情が芽生え始める
    crushKeepThreshold: 38, // これを下回る状態が続くと片思いが冷めていく
    crushGrowthPerHour: 4,
    crushDecayPerHour: 6,
    crushAbandonRomance: 12,
    confessReadiness: 62, // 恋愛感情がこれを超えると告白を検討する
    confessBaseChance: 0.012, // 条件を満たした状態で1回の交流機会に告白する基礎確率
    breakupGrudgeThreshold: 40,
    jealousyGainOnRivalCloseness: 5.5,
    jealousyDecayPerDay: 3,
    jealousyHostilityThreshold: 45, // これを超えるとライバルへの敵意行動が増える
  },

  incident: {
    firstDay: 2,
    intervalDaysMin: 3,
    intervalDaysMax: 5,
    investigationMinutes: 8 * 60,
    testimonyShareIntervalMinutes: 75,
    truthfulWitnesses: 1,
    mistakenWitnesses: 2,
  },

  personality: {
    min: 5,
    max: 95,
  },

  factionMap: {
    springStrength: 0.02,
    repulsion: 900,
    damping: 0.85,
  },

  debug: {
    logHistoryLimit: 500,
  },
} as const;
