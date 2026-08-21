import { CONFIG } from '../config';
import type { World } from '../sim/World';

interface NodeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class RelationshipMapUI {
  private world: World;
  private canvas = document.getElementById('map-canvas') as HTMLCanvasElement;
  private overlay = document.getElementById('map-overlay')!;
  private nodes: Map<string, NodeState> = new Map();
  private running = false;
  private rafId = 0;

  constructor(world: World) {
    this.world = world;
    document.getElementById('btn-map')!.addEventListener('click', () => this.open());
    document.getElementById('map-close')!.addEventListener('click', () => this.close());
    this.resetNodes();
  }

  setWorld(world: World): void {
    this.world = world;
    this.resetNodes();
  }

  private resetNodes(): void {
    this.nodes.clear();
    const n = this.world.npcs.length;
    this.world.npcs.forEach((npc, i) => {
      const angle = (i / n) * Math.PI * 2;
      this.nodes.set(npc.id, { x: Math.cos(angle) * 120, y: Math.sin(angle) * 120, vx: 0, vy: 0 });
    });
  }

  private open(): void {
    this.overlay.classList.remove('hidden');
    this.running = true;
    this.loop();
  }

  private close(): void {
    this.overlay.classList.add('hidden');
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.step();
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(): void {
    const npcs = this.world.npcs;
    for (const npc of npcs) {
      if (!this.nodes.has(npc.id)) {
        this.nodes.set(npc.id, { x: Math.random() * 100 - 50, y: Math.random() * 100 - 50, vx: 0, vy: 0 });
      }
    }

    const cfg = CONFIG.factionMap;
    for (const a of npcs) {
      const na = this.nodes.get(a.id)!;
      let fx = 0;
      let fy = 0;

      for (const b of npcs) {
        if (a === b) continue;
        const nb = this.nodes.get(b.id)!;
        const dx = na.x - nb.x;
        const dy = na.y - nb.y;
        const distSq = Math.max(400, dx * dx + dy * dy);
        const rep = cfg.repulsion / distSq;
        fx += (dx / Math.sqrt(distSq)) * rep;
        fy += (dy / Math.sqrt(distSq)) * rep;

        const edge = this.world.relationships.get(a.id, b.id);
        const back = this.world.relationships.get(b.id, a.id);
        const strength = (edge.affection + back.affection) / 2;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = strength > 0 ? 130 - strength * 0.9 : 190 + Math.abs(strength) * 0.6;
        const spring = (dist - targetDist) * cfg.springStrength;
        fx -= (dx / dist) * spring;
        fy -= (dy / dist) * spring;
      }

      fx += -na.x * 0.003;
      fy += -na.y * 0.003;

      na.vx = (na.vx + fx) * cfg.damping;
      na.vy = (na.vy + fy) * cfg.damping;
      na.x += na.vx;
      na.y += na.vy;
    }
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')!;
    const rect = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(rect.width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(rect.height * pixelRatio));
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    const w = rect.width;
    const h = rect.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.save();
    ctx.translate(w / 2, h / 2);

    const npcs = this.world.npcs;

    // edges
    for (let i = 0; i < npcs.length; i++) {
      for (let j = i + 1; j < npcs.length; j++) {
        const a = npcs[i];
        const b = npcs[j];
        const na = this.nodes.get(a.id)!;
        const nb = this.nodes.get(b.id)!;
        const eAB = this.world.relationships.get(a.id, b.id);
        const eBA = this.world.relationships.get(b.id, a.id);
        const avgAff = (eAB.affection + eBA.affection) / 2;
        const romance = Math.max(eAB.romance, eBA.romance);
        const isDating =
          (a.romance.stage === 'dating' && a.romance.targetId === b.id) ||
          (b.romance.stage === 'dating' && b.romance.targetId === a.id);
        const isHostile = avgAff < -18 || eAB.grudge > 30 || eBA.grudge > 30;

        if (Math.abs(avgAff) < 12 && !isDating && romance < 20 && !isHostile) continue;

        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.lineTo(nb.x, nb.y);
        if (isDating) {
          ctx.strokeStyle = '#ff5d8f';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([]);
        } else if (isHostile) {
          ctx.strokeStyle = '#e0555a';
          ctx.lineWidth = 1.5 + Math.min(3, eAB.grudge / 30);
          ctx.setLineDash([6, 4]);
        } else if (romance > 20) {
          ctx.strokeStyle = '#ffa8c5';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 3]);
        } else if (avgAff > 0) {
          ctx.strokeStyle = `rgba(120, 200, 150, ${Math.min(0.9, avgAff / 70)})`;
          ctx.lineWidth = 1 + avgAff / 35;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(200,200,200,0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // nodes
    for (const npc of npcs) {
      const n = this.nodes.get(npc.id)!;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#' + npc.appearance.bodyColor.toString(16).padStart(6, '0');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = npc.romance.stage === 'dating' ? '#ff5d8f' : 'rgba(255,255,255,0.6)';
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, n.x, n.y + 30);
    }

    ctx.restore();
  }
}
