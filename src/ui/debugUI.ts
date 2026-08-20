import type { World } from '../sim/World';
import { formatTime } from '../sim/eventLog';

export class DebugUI {
  private world: World;
  private overlay = document.getElementById('debug-overlay')!;
  private content = document.getElementById('debug-content')!;
  private visible = false;

  constructor(world: World) {
    this.world = world;
    document.getElementById('btn-debug')!.addEventListener('click', () => this.toggle());
    document.getElementById('debug-close')!.addEventListener('click', () => this.close());
  }

  setWorld(world: World): void {
    this.world = world;
  }

  private toggle(): void {
    this.visible = !this.visible;
    this.overlay.classList.toggle('hidden', !this.visible);
    if (this.visible) this.refresh();
  }

  private close(): void {
    this.visible = false;
    this.overlay.classList.add('hidden');
  }

  refresh(): void {
    if (!this.visible) return;
    const npcs = this.world.npcs;

    const personalityRows = npcs
      .map(
        (n) => `<tr>
        <td>${n.name}</td>
        <td>${n.personality.sociability}</td>
        <td>${n.personality.aggression}</td>
        <td>${n.personality.kindness}</td>
        <td>${n.personality.jealousy}</td>
        <td>${n.personality.romanceDrive}</td>
        <td>${n.personality.timidity}</td>
        <td>${n.personality.honesty}</td>
        <td>${n.personality.greed}</td>
        <td>${n.personality.curiosity}</td>
        <td>${n.personality.gossipy}</td>
      </tr>`,
      )
      .join('');

    const stateRows = npcs
      .map(
        (n) => `<tr>
        <td>${n.name}</td>
        <td>${n.activity}</td>
        <td>${Math.round(n.needs.hunger)}</td>
        <td>${Math.round(n.needs.fatigue)}</td>
        <td>${Math.round(n.needs.loneliness)}</td>
        <td>${Math.round(n.needs.fun)}</td>
        <td>${Math.round(n.needs.social)}</td>
        <td>${Math.round(n.mood())}</td>
        <td>${n.romance.stage}${n.romance.targetId ? ' → ' + (this.world.getNpc(n.romance.targetId)?.name ?? '?') : ''}</td>
      </tr>`,
      )
      .join('');

    const relRows: string[] = [];
    for (const a of npcs) {
      const row = this.world.relationships.rowFor(a.id);
      for (const [id, edge] of row) {
        const b = this.world.getNpc(id);
        if (!b) continue;
        if (Math.abs(edge.affection) < 5 && edge.romance < 5 && edge.grudge < 5 && edge.jealousy < 5) continue;
        relRows.push(`<tr>
          <td>${a.name} → ${b.name}</td>
          <td>${Math.round(edge.affection)}</td>
          <td>${Math.round(edge.trust)}</td>
          <td>${Math.round(edge.romance)}</td>
          <td>${Math.round(edge.jealousy)}</td>
          <td>${Math.round(edge.grudge)}</td>
        </tr>`);
      }
    }

    const memoryBlocks = npcs
      .map((n) => {
        const items = [...n.memory]
          .sort((a, b) => b.tick - a.tick)
          .slice(0, 8)
          .map((m) => `<div>${formatTime(m.tick)} [${Math.round(m.weight)}] ${m.text}${m.fromRumor ? ' (伝聞)' : ''}</div>`)
          .join('');
        return `<div class="debug-section"><h4>${n.name}の記憶</h4>${items || '<div>なし</div>'}</div>`;
      })
      .join('');

    this.content.innerHTML = `
      <div class="debug-section">
        <h4>性格 (0-100)</h4>
        <table>
          <thead><tr><th>名前</th><th>社交</th><th>攻撃</th><th>優しさ</th><th>嫉妬</th><th>恋愛</th><th>臆病</th><th>誠実</th><th>金銭欲</th><th>好奇心</th><th>噂好き</th></tr></thead>
          <tbody>${personalityRows}</tbody>
        </table>
      </div>
      <div class="debug-section">
        <h4>現在の状態</h4>
        <table>
          <thead><tr><th>名前</th><th>行動</th><th>空腹</th><th>疲労</th><th>孤独</th><th>娯楽</th><th>社交</th><th>気分</th><th>恋愛状態</th></tr></thead>
          <tbody>${stateRows}</tbody>
        </table>
      </div>
      <div class="debug-section">
        <h4>関係値 (目立つものだけ表示)</h4>
        <table>
          <thead><tr><th>関係</th><th>好感</th><th>信頼</th><th>恋愛</th><th>嫉妬</th><th>恨み</th></tr></thead>
          <tbody>${relRows.join('') || '<tr><td colspan="6">まだ目立った関係はない</td></tr>'}</tbody>
        </table>
      </div>
      <div class="debug-section">
        <h4>記憶(直近8件ずつ)</h4>
        ${memoryBlocks}
      </div>
    `;
  }
}
