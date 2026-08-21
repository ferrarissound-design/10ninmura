import * as THREE from 'three';
import './style.css';
import { World } from './sim/World';
import { SceneManager } from './scene/SceneManager';
import { buildVillage } from './scene/village';
import { NpcMesh } from './scene/npcMesh';
import { applyDayNight } from './scene/dayNight';
import { initEventLogUI } from './ui/eventLogUI';
import { NpcPanelUI } from './ui/npcPanelUI';
import { TimeUI } from './ui/timeUI';
import { RelationshipMapUI } from './ui/mapUI';
import { DebugUI } from './ui/debugUI';
import { OverheadUI } from './ui/overheadUI';
import { VillageUI } from './ui/villageUI';
import { ChronicleUI } from './ui/chronicleUI';
import { VillageDataUI } from './ui/dataUI';

const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement;

let world = new World();
const sceneManager = new SceneManager(canvas);

let villageGroup = buildVillage(world.layout);
sceneManager.scene.add(villageGroup);

let npcMeshes: NpcMesh[] = createNpcMeshes(world);

const npcPanel = new NpcPanelUI(world);
const timeUI = new TimeUI(world);
const mapUI = new RelationshipMapUI(world);
const debugUI = new DebugUI(world);
const overheadUI = new OverheadUI();
const villageUI = new VillageUI(world);
const chronicleUI = new ChronicleUI(world.eventLog);
const dataUI = new VillageDataUI(world, replaceWorld);

initEventLogUI(world.eventLog);
overheadUI.sync(npcMeshes);

npcPanel.onCloseCb = () => {
  for (const m of npcMeshes) m.setSelected(false);
};

function createNpcMeshes(w: World): NpcMesh[] {
  const meshes: NpcMesh[] = [];
  w.npcs.forEach((npc, i) => {
    const mesh = new NpcMesh(npc, (i * 0.37 + 0.15) % 1);
    sceneManager.scene.add(mesh.root);
    meshes.push(mesh);
  });
  return meshes;
}

function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m.dispose();
    } else if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  });
}

function clearNpcMeshes(): void {
  for (const m of npcMeshes) {
    sceneManager.scene.remove(m.root);
    disposeObject3D(m.root);
  }
  npcMeshes = [];
}

// ---- クリックでNPC選択 ----
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener('click', (ev) => {
  pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, sceneManager.camera);
  const targets = npcMeshes.map((m) => m.root);
  const hits = raycaster.intersectObjects(targets, true);
  if (hits.length === 0) return;
  let obj: THREE.Object3D | null = hits[0].object;
  while (obj && !obj.userData.npcId) obj = obj.parent;
  const npcId = obj?.userData.npcId as string | undefined;
  if (!npcId) return;

  for (const m of npcMeshes) m.setSelected(m.npc.id === npcId);
  npcPanel.show(npcId);
});

// ---- 新しい村を作る ----
function replaceWorld(nextWorld: World, preserveSpeed = true): void {
  npcPanel.hide();
  sceneManager.scene.remove(villageGroup);
  disposeObject3D(villageGroup);
  clearNpcMeshes();

  world = nextWorld;
  villageGroup = buildVillage(world.layout);
  sceneManager.scene.add(villageGroup);
  npcMeshes = createNpcMeshes(world);
  overheadUI.sync(npcMeshes);

  npcPanel.setWorld(world);
  timeUI.setWorld(world, preserveSpeed);
  mapUI.setWorld(world);
  debugUI.setWorld(world);
  villageUI.setWorld(world);
  chronicleUI.setEventLog(world.eventLog);
  dataUI.setWorld(world);
  initEventLogUI(world.eventLog);
}

document.getElementById('btn-restart')!.addEventListener('click', () => {
  replaceWorld(new World());
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const closeButton = document.querySelector<HTMLElement>(
    '#map-overlay:not(.hidden) .overlay-close, #debug-overlay:not(.hidden) .overlay-close, #village-overlay:not(.hidden) .overlay-close, #chronicle-overlay:not(.hidden) .overlay-close, #data-overlay:not(.hidden) .overlay-close',
  );
  closeButton?.click();
});

// ---- メインループ ----
const clock = new THREE.Clock();
let uiRefreshAccumulator = 0;

function animate(): void {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);

  world.update(delta);

  for (const mesh of npcMeshes) mesh.update(delta);

  applyDayNight(sceneManager, world.tick);
  overheadUI.update(sceneManager, npcMeshes);

  uiRefreshAccumulator += delta;
  if (uiRefreshAccumulator > 0.25) {
    uiRefreshAccumulator = 0;
    timeUI.refreshClock();
    npcPanel.refresh();
    debugUI.refresh();
    villageUI.refresh();
    chronicleUI.refresh();
  }

  sceneManager.render();
}

animate();
