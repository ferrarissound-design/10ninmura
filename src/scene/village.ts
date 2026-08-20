import * as THREE from 'three';
import type { VillageLayout } from '../sim/villageLayout';

const HOUSE_WALL_COLORS = [0xf2e2c4, 0xe8c9a0, 0xd9b48f, 0xf0d9b5, 0xe3d0c0];
const HOUSE_ROOF_COLORS = [0xb5553d, 0x8a4a3a, 0x5f7a61, 0x4c6b8a, 0xa06a3f];

function makeGround(layout: VillageLayout): THREE.Group {
  const group = new THREE.Group();

  const groundGeo = new THREE.PlaneGeometry(
    layout.bounds.maxX - layout.bounds.minX + 20,
    layout.bounds.maxZ - layout.bounds.minZ + 20,
    1,
    1,
  );
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x7fb069 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const plazaGeo = new THREE.CircleGeometry(layout.plaza.radius, 24);
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0xd8c9a3 });
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(layout.plaza.x, 0.02, layout.plaza.z);
  plaza.receiveShadow = true;
  group.add(plaza);

  const roadMat = new THREE.MeshLambertMaterial({ color: 0xc9b892 });
  for (const road of layout.roads) {
    const dx = road.x2 - road.x1;
    const dz = road.z2 - road.z1;
    const len = Math.hypot(dx, dz);
    const roadGeo = new THREE.PlaneGeometry(1.6, len);
    const mesh = new THREE.Mesh(roadGeo, roadMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = -Math.atan2(dx, dz);
    mesh.position.set((road.x1 + road.x2) / 2, 0.015, (road.z1 + road.z2) / 2);
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  return group;
}

function makeHouse(x: number, z: number, rotY: number, colorSeed: number): THREE.Group {
  const group = new THREE.Group();
  const wallColor = HOUSE_WALL_COLORS[Math.floor(colorSeed * HOUSE_WALL_COLORS.length) % HOUSE_WALL_COLORS.length];
  const roofColor = HOUSE_ROOF_COLORS[Math.floor(colorSeed * 97 * HOUSE_ROOF_COLORS.length) % HOUSE_ROOF_COLORS.length];

  const bodyGeo = new THREE.BoxGeometry(3.2, 2.1, 3.2);
  const bodyMat = new THREE.MeshLambertMaterial({ color: wallColor });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.05;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const roofGeo = new THREE.ConeGeometry(2.55, 1.7, 4);
  const roofMat = new THREE.MeshLambertMaterial({ color: roofColor });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.1 + 0.85;
  roof.castShadow = true;
  group.add(roof);

  const doorGeo = new THREE.BoxGeometry(0.7, 1.1, 0.12);
  const doorMat = new THREE.MeshLambertMaterial({ color: 0x5b3a29 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 0.55, 1.62);
  group.add(door);

  const windowGeo = new THREE.BoxGeometry(0.55, 0.55, 0.1);
  const windowMat = new THREE.MeshLambertMaterial({ color: 0xaee0f2 });
  const win1 = new THREE.Mesh(windowGeo, windowMat);
  win1.position.set(-1.1, 1.3, 1.62);
  group.add(win1);
  const win2 = win1.clone();
  win2.position.x = 1.1;
  group.add(win2);

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

function makeBench(x: number, z: number, rotY: number): THREE.Group {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), woodMat);
  seat.position.y = 0.45;
  seat.castShadow = true;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.1), woodMat);
  back.position.set(0, 0.72, -0.2);
  group.add(back);

  for (const dx of [-0.65, 0.65]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.45), woodMat);
    leg.position.set(dx, 0.22, 0);
    group.add(leg);
  }

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  return group;
}

function makeTree(x: number, z: number, scale: number, kind: 'round' | 'tall'): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 6), trunkMat);
  trunk.position.y = 0.55;
  trunk.castShadow = true;
  group.add(trunk);

  const leafMat = new THREE.MeshLambertMaterial({ color: kind === 'round' ? 0x5f9e5f : 0x4f8f6f });
  if (kind === 'round') {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), leafMat);
    leaf.position.y = 1.5;
    leaf.castShadow = true;
    group.add(leaf);
  } else {
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.85 - i * 0.2, 1.0, 7), leafMat);
      cone.position.y = 1.3 + i * 0.72;
      cone.castShadow = true;
      group.add(cone);
    }
  }

  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  return group;
}

function makeField(x: number, z: number, width: number, depth: number, cropSeed: number): THREE.Group {
  const group = new THREE.Group();
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x6b4a30 });
  const soil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), soilMat);
  soil.position.y = 0.03;
  soil.receiveShadow = true;
  group.add(soil);

  const cropMat = new THREE.MeshLambertMaterial({ color: 0x8fbf5a });
  const rows = 4;
  const cols = 6;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r * cols + c) / (rows * cols) > 0.55 + cropSeed * 0.3) continue;
      const crop = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 5), cropMat);
      crop.position.set(
        -width / 2 + (c + 0.5) * (width / cols),
        0.24,
        -depth / 2 + (r + 0.5) * (depth / rows),
      );
      crop.castShadow = true;
      group.add(crop);
    }
  }

  group.position.set(x, 0, z);
  return group;
}

function makePlazaLandmark(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x9aa5ad });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.5, 10), baseMat);
  base.position.y = 0.25;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const postMat = new THREE.MeshLambertMaterial({ color: 0x7c8891 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.3, 8), postMat);
  post.position.y = 1.15;
  post.castShadow = true;
  group.add(post);

  const topMat = new THREE.MeshLambertMaterial({ color: 0xe0b34d });
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), topMat);
  top.position.y = 1.95;
  top.castShadow = true;
  group.add(top);

  group.position.set(x, 0, z);
  return group;
}

export function buildVillage(layout: VillageLayout): THREE.Group {
  const root = new THREE.Group();
  root.add(makeGround(layout));

  for (const h of layout.houses) root.add(makeHouse(h.x, h.z, h.rotY, h.colorSeed));
  for (const b of layout.benches) root.add(makeBench(b.x, b.z, b.rotY));
  for (const t of layout.trees) root.add(makeTree(t.x, t.z, t.scale, t.kind));
  for (const f of layout.fields) root.add(makeField(f.x, f.z, f.width, f.depth, f.cropSeed));
  root.add(makePlazaLandmark(layout.plaza.x, layout.plaza.z));

  return root;
}
