import { CONFIG } from '../config';
import type { NpcId, RelationshipEdge } from '../types';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function freshEdge(): RelationshipEdge {
  return { affection: 0, trust: 0, romance: 0, jealousy: 0, grudge: 0 };
}

export class RelationshipMatrix {
  private edges: Map<NpcId, Map<NpcId, RelationshipEdge>> = new Map();

  init(ids: NpcId[]): void {
    this.edges.clear();
    for (const a of ids) {
      const row = new Map<NpcId, RelationshipEdge>();
      for (const b of ids) {
        if (a === b) continue;
        row.set(b, freshEdge());
      }
      this.edges.set(a, row);
    }
  }

  get(from: NpcId, to: NpcId): RelationshipEdge {
    let row = this.edges.get(from);
    if (!row) {
      row = new Map();
      this.edges.set(from, row);
    }
    let edge = row.get(to);
    if (!edge) {
      edge = freshEdge();
      row.set(to, edge);
    }
    return edge;
  }

  rowFor(from: NpcId): Map<NpcId, RelationshipEdge> {
    return this.edges.get(from) ?? new Map();
  }

  adjustAffection(from: NpcId, to: NpcId, delta: number, trustRatio = CONFIG.relationship.trustDeltaScale): void {
    const e = this.get(from, to);
    e.affection = clamp(e.affection + delta, CONFIG.relationship.affectionMin, CONFIG.relationship.affectionMax);
    e.trust = clamp(e.trust + delta * trustRatio, CONFIG.relationship.affectionMin, CONFIG.relationship.affectionMax);
  }

  adjustTrust(from: NpcId, to: NpcId, delta: number): void {
    const e = this.get(from, to);
    e.trust = clamp(e.trust + delta, CONFIG.relationship.affectionMin, CONFIG.relationship.affectionMax);
  }

  adjustRomance(from: NpcId, to: NpcId, delta: number): void {
    const e = this.get(from, to);
    e.romance = clamp(e.romance + delta, 0, CONFIG.relationship.romanceMax);
  }

  adjustGrudge(from: NpcId, to: NpcId, delta: number): void {
    const e = this.get(from, to);
    e.grudge = clamp(e.grudge + delta, 0, CONFIG.relationship.grudgeMax);
  }

  adjustJealousy(from: NpcId, to: NpcId, delta: number): void {
    const e = this.get(from, to);
    e.jealousy = clamp(e.jealousy + delta, 0, CONFIG.relationship.jealousyMax);
  }

  decayJealousy(ids: NpcId[], amount: number): void {
    for (const a of ids) {
      const row = this.edges.get(a);
      if (!row) continue;
      for (const e of row.values()) {
        e.jealousy = clamp(e.jealousy - amount, 0, CONFIG.relationship.jealousyMax);
        e.grudge = clamp(e.grudge - amount * 0.4, 0, CONFIG.relationship.grudgeMax);
      }
    }
  }
}
