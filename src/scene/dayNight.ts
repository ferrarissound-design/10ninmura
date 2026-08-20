import * as THREE from 'three';
import type { SceneManager } from './SceneManager';
import { daylightFactor, hourOfTick } from '../sim/time';

const SKY_DAY = new THREE.Color(0xbcd4e8);
const SKY_NIGHT = new THREE.Color(0x0b1030);
const FOG_DAY = new THREE.Color(0xbcd4e8);
const FOG_NIGHT = new THREE.Color(0x0b1030);
const SUN_DAY = new THREE.Color(0xfff2d6);
const SUN_NIGHT = new THREE.Color(0x8ea2ff);

export function applyDayNight(sceneManager: SceneManager, tick: number): void {
  const light = daylightFactor(tick);
  const hour = hourOfTick(tick);

  const sky = SKY_NIGHT.clone().lerp(SKY_DAY, light);
  sceneManager.renderer.setClearColor(sky);
  if (sceneManager.scene.fog instanceof THREE.Fog) {
    sceneManager.scene.fog.color.copy(FOG_NIGHT.clone().lerp(FOG_DAY, light));
  }

  sceneManager.sun.intensity = 0.15 + light * 1.05;
  sceneManager.sun.color.copy(SUN_NIGHT.clone().lerp(SUN_DAY, light));
  sceneManager.hemi.intensity = 0.2 + light * 0.6;

  const angle = ((hour / 24) * Math.PI * 2) - Math.PI / 2;
  const radius = 40;
  sceneManager.sun.position.set(Math.cos(angle) * radius, Math.max(6, Math.sin(angle) * radius + 10), 14);
  sceneManager.sun.target.position.set(0, 0, 0);
}
