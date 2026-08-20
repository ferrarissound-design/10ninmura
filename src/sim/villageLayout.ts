import type { Rng } from '../rng';

export interface Poi {
  id: string;
  x: number;
  z: number;
}

export interface HousePoi extends Poi {
  npcIndex: number;
  rotY: number;
  colorSeed: number;
}

export interface BenchPoi extends Poi {
  rotY: number;
}

export interface TreePoi extends Poi {
  scale: number;
  kind: 'round' | 'tall';
}

export interface FieldPoi extends Poi {
  width: number;
  depth: number;
  cropSeed: number;
}

export interface RoadSegment {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface VillageLayout {
  plaza: { x: number; z: number; radius: number };
  houses: HousePoi[];
  benches: BenchPoi[];
  trees: TreePoi[];
  fields: FieldPoi[];
  roads: RoadSegment[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

function dist(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(ax - bx, az - bz);
}

export function generateVillageLayout(npcCount: number, rng: Rng): VillageLayout {
  const plaza = { x: 0, z: 0, radius: 6.5 };
  const houseRadius = 17;
  const houses: HousePoi[] = [];
  const angleJitter = 0.18;
  for (let i = 0; i < npcCount; i++) {
    const angle = (i / npcCount) * Math.PI * 2 + rng.range(-angleJitter, angleJitter);
    const r = houseRadius + rng.range(-1.5, 1.5);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    houses.push({
      id: `house_${i}`,
      npcIndex: i,
      x,
      z,
      rotY: -angle + Math.PI / 2,
      colorSeed: rng.next(),
    });
  }

  const benches: BenchPoi[] = [];
  const benchCount = 6;
  for (let i = 0; i < benchCount; i++) {
    const angle = (i / benchCount) * Math.PI * 2 + Math.PI / benchCount;
    const r = plaza.radius + 2.6;
    benches.push({
      id: `bench_${i}`,
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      rotY: angle + Math.PI / 2,
    });
  }

  const fields: FieldPoi[] = [
    { id: 'field_0', x: -30, z: 14, width: 10, depth: 7, cropSeed: rng.next() },
    { id: 'field_1', x: -30, z: -14, width: 10, depth: 7, cropSeed: rng.next() },
  ];

  const occupied: { x: number; z: number; r: number }[] = [
    { x: plaza.x, z: plaza.z, r: plaza.radius + 1.5 },
    ...houses.map((h) => ({ x: h.x, z: h.z, r: 3.2 })),
    ...benches.map((b) => ({ x: b.x, z: b.z, r: 1.6 })),
    ...fields.map((f) => ({ x: f.x, z: f.z, r: Math.max(f.width, f.depth) })),
  ];

  const trees: TreePoi[] = [];
  const bounds = { minX: -40, maxX: 40, minZ: -32, maxZ: 32 };
  let attempts = 0;
  while (trees.length < 42 && attempts < 800) {
    attempts++;
    const x = rng.range(bounds.minX + 2, bounds.maxX - 2);
    const z = rng.range(bounds.minZ + 2, bounds.maxZ - 2);
    const tooClose = occupied.some((o) => dist(x, z, o.x, o.z) < o.r + 1.4);
    const tooCloseTree = trees.some((t) => dist(x, z, t.x, t.z) < 2.6);
    if (tooClose || tooCloseTree) continue;
    trees.push({
      id: `tree_${trees.length}`,
      x,
      z,
      scale: rng.range(0.75, 1.35),
      kind: rng.bool(0.6) ? 'round' : 'tall',
    });
  }

  const roads: RoadSegment[] = [];
  for (const h of houses) {
    roads.push({ x1: h.x, z1: h.z, x2: plaza.x, z2: plaza.z });
  }

  return { plaza, houses, benches, trees, fields, roads, bounds };
}
