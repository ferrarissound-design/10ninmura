import type { World } from '../sim/World';
import { formatTime } from '../sim/eventLog';

const ROLE_LABELS = {
  mayor: '村長',
  popular: '人気者',
  trusted: '信頼',
  outcast: '孤立',
  suspect: '容疑者',
} as const;

export class VillageUI {
  private world: World;
  private overlay = document.getElementById('village-overlay')!;
  private content = document.getElementById('village-content')!;
  private visible = false;

  constructor(world: World) {
    this.world = world;
    document.getElementById('btn-village')!.addEventListener('click', () => this.open());
    document.getElementById('village-close')!.addEventListener('click', () => this.close());
  }

  setWorld(world: World): void {
    this.world = world;
    this.refresh();
  }

  private open(): void {
    this.visible = true;
    this.overlay.classList.remove('hidden');
    this.refresh();
  }

  private close(): void {
    this.visible = false;
    this.overlay.classList.add('hidden');
  }

  refresh(): void {
    if (!this.visible) return;
    const incident =
      this.world.activeIncident ?? this.world.incidentHistory[this.world.incidentHistory.length - 1] ?? null;
    const statusRows = [...this.world.npcs]
      .sort((a, b) => b.socialStatus.reputation - a.socialStatus.reputation)
      .map((npc) => `<tr>
        <td>${escapeHtml(npc.name)}</td>
        <td>${npc.socialStatus.roles.map((role) => ROLE_LABELS[role]).join('・') || '村人'}</td>
        <td>${Math.round(npc.socialStatus.reputation)}</td>
      </tr>`)
      .join('');

    let incidentHtml = '<div class="empty-story">今のところ、村を揺るがす事件は起きていない。</div>';
    if (incident) {
      const phaseLabel = incident.phase === 'investigation' ? '調査中' : incident.phase === 'meeting' ? '村会議中' : '解決済み';
      const testimonyRows = incident.testimonies
        .filter((item) => item.shared || incident.phase === 'resolved')
        .map((item) => {
          const truth = incident.phase === 'resolved'
            ? `<span class="truth ${item.truth}">${item.truth === 'fact' ? '事実' : item.truth === 'lie' ? '嘘' : '勘違い'}</span>`
            : '';
          return `<li>${escapeHtml(item.text)} ${truth}</li>`;
        })
        .join('');
      const voteRows = incident.votes
        .map((vote) => {
          const voter = this.world.getNpc(vote.voterId)?.name ?? '?';
          const suspect = this.world.getNpc(vote.suspectId)?.name ?? '?';
          return `<li>${escapeHtml(voter)} → ${escapeHtml(suspect)}</li>`;
        })
        .join('');
      incidentHtml = `
        <div class="incident-card">
          <div class="incident-heading"><span>${escapeHtml(incident.title)}</span><span class="phase">${phaseLabel}</span></div>
          <p>${escapeHtml(incident.description)}</p>
          <div class="story-meta">発生: ${formatTime(incident.startedTick)} ／ 村会議: ${formatTime(incident.meetingTick)}</div>
          <h4>公開された証言</h4>
          <ul>${testimonyRows || '<li>まだ証言は出ていない</li>'}</ul>
          ${voteRows ? `<h4>投票結果</h4><ul class="vote-list">${voteRows}</ul>` : ''}
          ${incident.outcomeText ? `<div class="outcome">${escapeHtml(incident.outcomeText)}</div>` : ''}
        </div>`;
    }

    this.content.innerHTML = `
      <h3>現在の事件</h3>
      ${incidentHtml}
      <h3>村での立場</h3>
      <table class="status-table"><thead><tr><th>村人</th><th>立場</th><th>評判</th></tr></thead><tbody>${statusRows}</tbody></table>
    `;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
