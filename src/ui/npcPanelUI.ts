import type { World } from '../sim/World';
import type { Npc } from '../npc/Npc';
import type { NpcId, PersonalityTraits } from '../types';
import { formatTime } from '../sim/eventLog';

const TRAIT_LABELS: Record<keyof PersonalityTraits, string> = {
  sociability: '社交性',
  aggression: '攻撃性',
  kindness: '優しさ',
  jealousy: '嫉妬深さ',
  romanceDrive: '恋愛積極性',
  timidity: '臆病さ',
  honesty: '誠実さ',
  greed: '金銭欲',
  curiosity: '好奇心',
  gossipy: '噂好き度',
};

const NEED_LABELS: Record<string, string> = {
  hunger: '空腹',
  fatigue: '疲労',
  loneliness: '孤独',
  fun: '娯楽欲求',
  social: '社交欲求',
};

function colorHex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export class NpcPanelUI {
  private world: World;
  private panelEl = document.getElementById('npc-panel')!;
  private contentEl = document.getElementById('npc-panel-content')!;
  selectedId: NpcId | null = null;
  onCloseCb: (() => void) | null = null;

  constructor(world: World) {
    this.world = world;
    document.getElementById('npc-panel-close')!.addEventListener('click', () => this.hide());
  }

  setWorld(world: World): void {
    this.world = world;
    this.hide();
  }

  show(id: NpcId): void {
    this.selectedId = id;
    this.panelEl.classList.remove('hidden');
    this.refresh();
  }

  hide(): void {
    this.selectedId = null;
    this.panelEl.classList.add('hidden');
    this.onCloseCb?.();
  }

  refresh(): void {
    if (!this.selectedId) return;
    const npc = this.world.getNpc(this.selectedId);
    if (!npc) {
      this.hide();
      return;
    }
    this.contentEl.innerHTML = this.render(npc);
  }

  private render(npc: Npc): string {
    const genderLabel = npc.gender === 'male' ? '男性' : '女性';
    const mood = npc.mood();
    const moodLabel = mood > 40 ? 'とても機嫌がいい' : mood > 10 ? '機嫌がいい' : mood > -10 ? '普通' : mood > -40 ? '少し不機嫌' : '機嫌が悪い';

    const traitRows = (Object.keys(TRAIT_LABELS) as (keyof PersonalityTraits)[])
      .map((k) => this.traitRow(TRAIT_LABELS[k], npc.personality[k]))
      .join('');

    const needRows = (Object.keys(NEED_LABELS) as (keyof Npc['needs'])[])
      .map((k) => this.traitRow(NEED_LABELS[k], npc.needs[k], 'warm'))
      .join('');

    const row = this.world.relationships.rowFor(npc.id);
    const relEntries = [...row.entries()]
      .map(([id, edge]) => ({ id, edge, other: this.world.getNpc(id) }))
      .filter((e) => e.other)
      .sort((a, b) => b.edge.affection - a.edge.affection);

    const liked = relEntries.slice(0, 1)[0];
    const disliked = relEntries.slice(-1)[0];

    const romanceLabel = this.romanceLabel(npc);

    const relRows = relEntries
      .map(({ id, edge, other }) => {
        const tags: string[] = [];
        if (npc.romance.targetId === id && npc.romance.stage === 'dating') tags.push('💑交際');
        else if (npc.romance.targetId === id && npc.romance.stage === 'crush') tags.push('💗片思い');
        if (edge.jealousy > 40) tags.push('😠嫉妬');
        if (edge.grudge > 40) tags.push('💢恨み');
        const affColor = edge.affection >= 0 ? '#3d8a52' : '#c1666b';
        return `<div class="rel-row">
          <span class="npc-color-dot" style="width:12px;height:12px;background:${colorHex(other!.appearance.bodyColor)}"></span>
          <span class="name">${other!.name}</span>
          <span class="aff-val" style="color:${affColor}">${Math.round(edge.affection)}</span>
          <span class="tags">${tags.join(' ')}</span>
        </div>`;
      })
      .join('');

    const memories = [...npc.memory]
      .sort((a, b) => b.tick - a.tick)
      .slice(0, 10)
      .map((m) => `<div class="memory-item${m.isMajor ? ' major' : ''}">${formatTime(m.tick)} ${escapeHtml(m.text)}</div>`)
      .join('');

    return `
      <div class="npc-head">
        <span class="npc-color-dot" style="background:${colorHex(npc.appearance.bodyColor)}"></span>
        <div>
          <div class="npc-name">${npc.name}</div>
          <div class="npc-sub">${genderLabel}・${npc.activity}</div>
        </div>
      </div>
      <div class="mood-line">気分: ${moodLabel}${romanceLabel ? ' ／ ' + romanceLabel : ''}</div>
      <div class="mood-line">好きな相手: ${liked ? liked.other!.name : 'なし'} ／ 苦手な相手: ${disliked && disliked.edge.affection < 0 ? disliked.other!.name : 'なし'}</div>

      <div class="section-title">性格</div>
      ${traitRows}

      <div class="section-title">欲求</div>
      ${needRows}

      <div class="section-title">全員への好感度</div>
      <div class="rel-list">${relRows}</div>

      <div class="section-title">最近の記憶</div>
      ${memories || '<div class="memory-item">まだ何もない</div>'}
    `;
  }

  private romanceLabel(npc: Npc): string {
    if (npc.romance.stage === 'dating' && npc.romance.targetId) {
      const t = this.world.getNpc(npc.romance.targetId);
      return `💑 ${t?.name ?? '?'}と交際中`;
    }
    if (npc.romance.stage === 'crush' && npc.romance.targetId) {
      const t = this.world.getNpc(npc.romance.targetId);
      return `💗 ${t?.name ?? '?'}が気になっている`;
    }
    if (npc.romance.stage === 'heartbroken') {
      return '💔 失恋中';
    }
    return '';
  }

  private traitRow(label: string, value: number, tone: 'default' | 'warm' = 'default'): string {
    const pct = Math.max(0, Math.min(100, value));
    return `<div class="trait-row">
      <span class="label">${label}</span>
      <span class="bar-track"><span class="bar-fill ${tone === 'warm' ? 'warm' : ''}" style="width:${pct}%"></span></span>
      <span class="val">${Math.round(value)}</span>
    </div>`;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
