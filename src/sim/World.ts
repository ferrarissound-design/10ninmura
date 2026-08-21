import { CONFIG } from '../config';
import { Rng, makeSeed } from '../rng';
import { Npc } from '../npc/Npc';
import type { EventLogEntry, NpcId, VillageIncident } from '../types';
import { generateVillageLayout, type VillageLayout } from './villageLayout';
import { RelationshipMatrix, type RelationshipSnapshot } from './relationships';
import { EventLog } from './eventLog';
import { decayNeeds } from './needs';
import { chooseNextActivity, type BehaviorContext } from './behavior';
import { updateMovement } from './movement';
import { tryInteraction, type InteractionDeps } from './interactions';
import { updateBreakupCheck, updateCrushFormation } from './romance';
import { decayMemories } from './memory';
import { seedInitialRelationships } from './seeding';
import { dayIndex } from './time';
import { createVillageIncident, holdVillageMeeting, shareNextTestimony, type IncidentContext } from './incidents';
import { initializeVillageRoles, updateSocialStanding } from './social';

type NpcSnapshot = Omit<Npc, 'lastInteractionTick' | 'currentSpeech' | 'mostUrgentNeed' | 'mood'> & {
  lastInteractionTick: [NpcId, number][];
  currentSpeech: null;
};

export interface WorldSnapshot {
  version: 1;
  seed: number;
  rngState: number;
  tick: number;
  speedMultiplier: number;
  layout: VillageLayout;
  npcs: NpcSnapshot[];
  relationships: RelationshipSnapshot;
  eventEntries: EventLogEntry[];
  majorEventEntries: EventLogEntry[];
  activeIncident: VillageIncident | null;
  incidentHistory: VillageIncident[];
  lastDayProcessed: number;
  hourAccumulator: number;
  nextIncidentTick: number;
  lastTestimonyShareTick: number;
  incidentSequence: number;
}

export class World {
  npcs: Npc[] = [];
  layout!: VillageLayout;
  relationships = new RelationshipMatrix();
  eventLog = new EventLog();
  rng: Rng;
  tick = 0; // ゲーム内経過分(絶対値)
  speedMultiplier = 1;
  activeIncident: VillageIncident | null = null;
  incidentHistory: VillageIncident[] = [];
  seed: number;

  private lastDayProcessed = -1;
  private hourAccumulator = 0;
  private npcById: Map<NpcId, Npc> = new Map();
  private nextIncidentTick = 0;
  private lastTestimonyShareTick = 0;
  private incidentSequence = 0;

  constructor(seed: number = makeSeed()) {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.generate();
  }

  restart(seed: number = makeSeed()): void {
    this.seed = seed >>> 0;
    this.rng = new Rng(this.seed);
    this.generate();
  }

  static fromSnapshot(data: unknown): World {
    if (!data || typeof data !== 'object') throw new Error('保存データの形式が正しくありません。');
    const snapshot = data as Partial<WorldSnapshot>;
    if (snapshot.version !== 1 || !Number.isFinite(snapshot.seed) || !Array.isArray(snapshot.npcs)) {
      throw new Error('対応していない保存データです。');
    }
    if (snapshot.npcs.length !== CONFIG.npc.count) {
      throw new Error(`この保存データは${CONFIG.npc.count}人村用ではありません。`);
    }
    const world = new World(snapshot.seed);
    world.restoreSnapshot(snapshot as WorldSnapshot);
    return world;
  }

  toSnapshot(): WorldSnapshot {
    const npcs = this.npcs.map((npc) => ({
      ...npc,
      currentSpeech: null,
      lastInteractionTick: [...npc.lastInteractionTick.entries()],
    })) as NpcSnapshot[];

    return {
      version: 1,
      seed: this.seed,
      rngState: this.rng.getState(),
      tick: this.tick,
      speedMultiplier: this.speedMultiplier,
      layout: this.layout,
      npcs,
      relationships: this.relationships.toSnapshot(),
      eventEntries: this.eventLog.entries,
      majorEventEntries: this.eventLog.majorEntries,
      activeIncident: this.activeIncident,
      incidentHistory: this.incidentHistory,
      lastDayProcessed: this.lastDayProcessed,
      hourAccumulator: this.hourAccumulator,
      nextIncidentTick: this.nextIncidentTick,
      lastTestimonyShareTick: this.lastTestimonyShareTick,
      incidentSequence: this.incidentSequence,
    };
  }

  private restoreSnapshot(snapshot: WorldSnapshot): void {
    this.seed = snapshot.seed >>> 0;
    this.tick = snapshot.tick;
    this.speedMultiplier = snapshot.speedMultiplier;
    this.layout = snapshot.layout;
    this.lastDayProcessed = snapshot.lastDayProcessed;
    this.hourAccumulator = snapshot.hourAccumulator;
    this.nextIncidentTick = snapshot.nextIncidentTick;
    this.lastTestimonyShareTick = snapshot.lastTestimonyShareTick;
    this.incidentSequence = snapshot.incidentSequence;

    const savedById = new Map(snapshot.npcs.map((npc) => [npc.id, npc]));
    for (const npc of this.npcs) {
      const saved = savedById.get(npc.id);
      if (!saved) throw new Error(`村人 ${npc.id} の保存データが見つかりません。`);
      const { lastInteractionTick, currentSpeech: _currentSpeech, ...state } = saved;
      Object.assign(npc, state);
      npc.lastInteractionTick = new Map(lastInteractionTick);
      npc.currentSpeech = null;
    }
    this.npcById = new Map(this.npcs.map((npc) => [npc.id, npc]));

    this.relationships.loadSnapshot(snapshot.relationships);
    this.eventLog = new EventLog();
    this.eventLog.restore(snapshot.eventEntries, snapshot.majorEventEntries);
    this.incidentHistory = snapshot.incidentHistory;
    this.activeIncident = snapshot.activeIncident
      ? this.incidentHistory.find((incident) => incident.id === snapshot.activeIncident!.id) ?? snapshot.activeIncident
      : null;
    this.rng.setState(snapshot.rngState);
  }

  private generate(): void {
    this.tick = CONFIG.time.dayStartHour * 60;
    this.lastDayProcessed = dayIndex(this.tick);
    this.hourAccumulator = 0;
    this.activeIncident = null;
    this.incidentHistory = [];
    this.incidentSequence = 0;
    this.nextIncidentTick = (CONFIG.incident.firstDay - 1) * 24 * 60 + 10 * 60;
    this.lastTestimonyShareTick = 0;

    this.layout = generateVillageLayout(CONFIG.npc.count, this.rng);
    this.npcs = [];
    this.npcById.clear();
    const usedNames = new Set<string>();
    const usedColors = new Set<number>();
    for (let i = 0; i < CONFIG.npc.count; i++) {
      const npc = new Npc(i, this.rng, usedNames, usedColors);
      const house = this.layout.houses[i];
      npc.homeId = house.id;
      npc.position = { x: house.x + this.rng.range(-1, 1), z: house.z + this.rng.range(-1, 1) };
      this.npcs.push(npc);
      this.npcById.set(npc.id, npc);
    }

    this.relationships.init(this.npcs.map((n) => n.id));
    seedInitialRelationships(this.npcs, this.relationships, this.rng, this.tick);
    initializeVillageRoles(this.npcs);
    updateSocialStanding(this.npcs, this.relationships, null);

    this.eventLog = new EventLog();
    this.eventLog.push(this.tick, '新しい村ができた。10人の暮らしが始まる。', [], true);

    const ctx = this.behaviorContext();
    for (const npc of this.npcs) {
      chooseNextActivity(npc, ctx);
    }
  }

  getNpc(id: NpcId): Npc | undefined {
    return this.npcById.get(id);
  }

  private behaviorContext(): BehaviorContext {
    return { layout: this.layout, npcs: this.npcs, relationships: this.relationships, rng: this.rng, tick: this.tick };
  }

  private interactionDeps(): InteractionDeps {
    return {
      ...this.behaviorContext(),
      pushEvent: (text, npcIds, major) => this.eventLog.push(this.tick, text, npcIds, major),
      findNpc: (id) => this.npcById.get(id),
    };
  }

  private incidentContext(): IncidentContext {
    return {
      npcs: this.npcs,
      relationships: this.relationships,
      rng: this.rng,
      tick: this.tick,
      pushEvent: (text, npcIds, major) => this.eventLog.push(this.tick, text, npcIds, major),
      findNpc: (id) => this.npcById.get(id),
    };
  }

  update(realDeltaSeconds: number): void {
    if (this.speedMultiplier <= 0) return;
    const simDeltaSeconds = Math.min(realDeltaSeconds, 0.25) * this.speedMultiplier;
    const minutesDelta = simDeltaSeconds * CONFIG.time.minutesPerRealSecondAtX1;
    if (minutesDelta <= 0) return;

    this.tick += minutesDelta;
    const ctx = this.behaviorContext();

    for (const npc of this.npcs) {
      decayNeeds(npc, minutesDelta);
      updateMovement(npc, ctx, simDeltaSeconds, minutesDelta);
    }

    this.processInteractions(minutesDelta);
    this.processPeriodicChecks(minutesDelta);
  }

  private processInteractions(minutesDelta: number): void {
    const deps = this.interactionDeps();
    const radiusSq = CONFIG.interaction.radius * CONFIG.interaction.radius;
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      if (a.activity === 'interacting' || (a.activity === 'sleeping' && a.activityStarted)) continue;
      for (let j = i + 1; j < this.npcs.length; j++) {
        const b = this.npcs[j];
        if (b.activity === 'interacting' || (b.activity === 'sleeping' && b.activityStarted)) continue;
        const dx = a.position.x - b.position.x;
        const dz = a.position.z - b.position.z;
        if (dx * dx + dz * dz > radiusSq) continue;

        const sociabilityFactor = 0.4 + (a.personality.sociability + b.personality.sociability) / 260;
        const chance = CONFIG.interaction.baseChancePerMinute * minutesDelta * sociabilityFactor;
        if (this.rng.bool(Math.min(0.9, chance))) {
          tryInteraction(a, b, deps);
        }
      }
    }
  }

  private processPeriodicChecks(minutesDelta: number): void {
    this.processIncidentChecks();
    this.hourAccumulator += minutesDelta;
    if (this.hourAccumulator >= 60) {
      this.hourAccumulator -= 60;
      const romanceCtx = {
        npcs: this.npcs,
        relationships: this.relationships,
        eventLog: this.eventLog,
        rng: this.rng,
        tick: this.tick,
      };
      for (const npc of this.npcs) {
        updateCrushFormation(npc, romanceCtx);
        updateBreakupCheck(npc, romanceCtx);
      }
    }

    const currentDay = dayIndex(this.tick);
    if (currentDay !== this.lastDayProcessed) {
      this.lastDayProcessed = currentDay;
      for (const npc of this.npcs) decayMemories(npc);
      this.relationships.decayJealousy(
        this.npcs.map((n) => n.id),
        CONFIG.romance.jealousyDecayPerDay,
      );
      updateSocialStanding(this.npcs, this.relationships, this.activeIncident);
    }
  }

  private processIncidentChecks(): void {
    if (!this.activeIncident && this.tick >= this.nextIncidentTick) {
      this.activeIncident = createVillageIncident(this.incidentContext(), this.incidentSequence++);
      this.incidentHistory.push(this.activeIncident);
      this.lastTestimonyShareTick = this.tick;
      updateSocialStanding(this.npcs, this.relationships, this.activeIncident);
      return;
    }
    const incident = this.activeIncident;
    if (!incident || incident.phase === 'resolved') return;

    if (
      incident.phase === 'investigation' &&
      this.tick - this.lastTestimonyShareTick >= CONFIG.incident.testimonyShareIntervalMinutes
    ) {
      shareNextTestimony(incident, this.incidentContext());
      this.lastTestimonyShareTick = this.tick;
      updateSocialStanding(this.npcs, this.relationships, incident);
    }

    if (incident.phase === 'investigation' && this.tick >= incident.meetingTick) {
      holdVillageMeeting(incident, this.incidentContext());
      updateSocialStanding(this.npcs, this.relationships, incident);
      this.activeIncident = null;
      this.nextIncidentTick = this.tick + this.rng.range(
        CONFIG.incident.intervalDaysMin * 24 * 60,
        CONFIG.incident.intervalDaysMax * 24 * 60,
      );
    }
  }
}
