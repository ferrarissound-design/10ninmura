import * as THREE from 'three';
import type { Npc } from '../npc/Npc';

const SKIN_TONES = [0xf4c9a8, 0xe0ac7d, 0xc98f5e, 0x8d5a3c, 0xf7d9be];

export class NpcMesh {
  readonly root = new THREE.Group();
  readonly npc: Npc;
  private body: THREE.Mesh;
  private head: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private selectionRing: THREE.Mesh;
  private sleepIcon: THREE.Sprite;
  private walkPhase = 0;
  private lastPos: { x: number; z: number };

  constructor(npc: Npc, skinSeed: number) {
    this.npc = npc;
    this.lastPos = { x: npc.position.x, z: npc.position.z };
    const app = npc.appearance;
    const skin = SKIN_TONES[Math.floor(skinSeed * SKIN_TONES.length) % SKIN_TONES.length];

    this.root.userData.npcId = npc.id;

    const legMat = new THREE.MeshLambertMaterial({ color: 0x3a3a4a });
    this.leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 6), legMat);
    this.leftLeg.position.set(-0.14, 0.275, 0);
    this.leftLeg.castShadow = true;
    this.root.add(this.leftLeg);
    this.rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 6), legMat);
    this.rightLeg.position.set(0.14, 0.275, 0);
    this.rightLeg.castShadow = true;
    this.root.add(this.rightLeg);

    const bodyMat = new THREE.MeshLambertMaterial({ color: app.bodyColor });
    this.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.55, 4, 8), bodyMat);
    this.body.position.y = 0.85;
    this.body.castShadow = true;
    this.root.add(this.body);
    this.body.userData.npcId = npc.id;

    const accentMat = new THREE.MeshLambertMaterial({ color: app.accentColor });
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.05, 6, 12), accentMat);
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.68;
    this.root.add(sash);

    const armMat = new THREE.MeshLambertMaterial({ color: app.bodyColor });
    this.leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 6), armMat);
    this.leftArm.position.set(-0.42, 0.85, 0);
    this.leftArm.castShadow = true;
    this.root.add(this.leftArm);
    this.rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 6), armMat.clone());
    this.rightArm.position.set(0.42, 0.85, 0);
    this.rightArm.castShadow = true;
    this.root.add(this.rightArm);

    const headMat = new THREE.MeshLambertMaterial({ color: skin });
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), headMat);
    this.head.position.y = 1.36;
    this.head.castShadow = true;
    this.root.add(this.head);
    this.head.userData.npcId = npc.id;

    this.buildHair(app.hairStyle, app.hairColor);

    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0 });
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = 0.03;
    this.root.add(this.selectionRing);

    const sleepCanvas = document.createElement('canvas');
    sleepCanvas.width = 64;
    sleepCanvas.height = 64;
    const c2d = sleepCanvas.getContext('2d')!;
    c2d.font = '48px sans-serif';
    c2d.textAlign = 'center';
    c2d.textBaseline = 'middle';
    c2d.fillText('💤', 32, 32);
    const sleepTex = new THREE.CanvasTexture(sleepCanvas);
    const sleepMat = new THREE.SpriteMaterial({ map: sleepTex, transparent: true, depthTest: false });
    this.sleepIcon = new THREE.Sprite(sleepMat);
    this.sleepIcon.scale.set(0.5, 0.5, 0.5);
    this.sleepIcon.position.set(0.35, 1.75, 0);
    this.sleepIcon.visible = false;
    this.root.add(this.sleepIcon);

    this.root.scale.setScalar(app.height);
  }

  private buildHair(style: Npc['appearance']['hairStyle'], color: number): void {
    if (style === 'bald') return;
    const mat = new THREE.MeshLambertMaterial({ color });
    if (style === 'short') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
      hair.position.y = 1.4;
      hair.castShadow = true;
      this.root.add(hair);
    } else if (style === 'long') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), mat);
      hair.position.y = 1.4;
      this.root.add(hair);
      const back = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), mat);
      back.position.set(0, 1.1, -0.12);
      back.rotation.x = Math.PI;
      this.root.add(back);
    } else if (style === 'bun') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58), mat);
      hair.position.y = 1.4;
      this.root.add(hair);
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), mat);
      bun.position.set(0, 1.62, -0.05);
      this.root.add(bun);
    } else if (style === 'spiky') {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
      hair.position.y = 1.42;
      this.root.add(hair);
      for (let i = 0; i < 5; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), mat);
        const angle = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(angle) * 0.16, 1.58, Math.sin(angle) * 0.16);
        spike.rotation.z = Math.cos(angle) * 0.5;
        spike.rotation.x = Math.sin(angle) * -0.5;
        this.root.add(spike);
      }
    }
  }

  setSelected(selected: boolean): void {
    (this.selectionRing.material as THREE.MeshBasicMaterial).opacity = selected ? 0.85 : 0;
  }

  headWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    this.head.getWorldPosition(target);
    return target;
  }

  update(deltaSeconds: number): void {
    const npc = this.npc;
    this.root.position.set(npc.position.x, 0, npc.position.z);
    this.root.rotation.y = npc.facing;

    const dx = npc.position.x - this.lastPos.x;
    const dz = npc.position.z - this.lastPos.z;
    const moved = Math.hypot(dx, dz);
    this.lastPos = { x: npc.position.x, z: npc.position.z };
    const isMoving = moved > 0.001;

    if (isMoving) {
      this.walkPhase += deltaSeconds * 9;
      const swing = Math.sin(this.walkPhase) * 0.5;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.8;
      this.rightArm.rotation.x = swing * 0.8;
      this.body.position.y = 0.85 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.02;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
    }

    this.sleepIcon.visible = npc.activity === 'sleeping' && npc.activityStarted;
    if (this.sleepIcon.visible) {
      this.sleepIcon.position.y = 1.75 + Math.sin(performance.now() * 0.002) * 0.05;
    }
  }
}
