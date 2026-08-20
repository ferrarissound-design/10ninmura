import * as THREE from 'three';
import type { SceneManager } from '../scene/SceneManager';
import type { NpcMesh } from '../scene/npcMesh';

interface Elems {
  bubble: HTMLDivElement;
  nameTag: HTMLDivElement;
}

export class OverheadUI {
  private layer = document.getElementById('tooltip-layer')!;
  private elems: Map<string, Elems> = new Map();
  private tmpVec = new THREE.Vector3();

  sync(meshes: NpcMesh[]): void {
    const activeIds = new Set(meshes.map((m) => m.npc.id));
    for (const [id, e] of this.elems) {
      if (!activeIds.has(id)) {
        e.bubble.remove();
        e.nameTag.remove();
        this.elems.delete(id);
      }
    }
    for (const mesh of meshes) {
      if (!this.elems.has(mesh.npc.id)) {
        const bubble = document.createElement('div');
        bubble.className = 'speech-bubble';
        bubble.style.display = 'none';
        const nameTag = document.createElement('div');
        nameTag.className = 'name-tag';
        nameTag.textContent = mesh.npc.name;
        this.layer.appendChild(nameTag);
        this.layer.appendChild(bubble);
        this.elems.set(mesh.npc.id, { bubble, nameTag });
      }
    }
  }

  update(sceneManager: SceneManager, meshes: NpcMesh[]): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const mesh of meshes) {
      const e = this.elems.get(mesh.npc.id);
      if (!e) continue;
      const worldPos = mesh.headWorldPosition(this.tmpVec);
      const proj = worldPos.clone().project(sceneManager.camera);
      const behind = proj.z > 1;
      const x = (proj.x * 0.5 + 0.5) * w;
      const y = (-proj.y * 0.5 + 0.5) * h;

      if (behind || x < -100 || x > w + 100 || y < -100 || y > h + 100) {
        e.bubble.style.display = 'none';
        e.nameTag.style.display = 'none';
        continue;
      }

      e.nameTag.style.display = 'block';
      e.nameTag.style.left = `${x}px`;
      e.nameTag.style.top = `${y - 34}px`;

      const speech = mesh.npc.currentSpeech;
      if (speech && performance.now() < speech.untilRealMs) {
        e.bubble.style.display = 'block';
        e.bubble.className = 'speech-bubble' + (speech.kind === 'major' ? ' major' : '');
        e.bubble.textContent = speech.text;
        e.bubble.style.left = `${x}px`;
        e.bubble.style.top = `${y - 48}px`;
      } else {
        e.bubble.style.display = 'none';
      }
    }
  }
}
