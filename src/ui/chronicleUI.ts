import type { EventLog } from '../sim/eventLog';

export class ChronicleUI {
  private eventLog: EventLog;
  private overlay = document.getElementById('chronicle-overlay')!;
  private content = document.getElementById('chronicle-content')!;
  private visible = false;

  constructor(eventLog: EventLog) {
    this.eventLog = eventLog;
    document.getElementById('btn-chronicle')!.addEventListener('click', () => this.open());
    document.getElementById('chronicle-close')!.addEventListener('click', () => this.close());
    this.listen();
  }

  setEventLog(eventLog: EventLog): void {
    this.eventLog = eventLog;
    this.listen();
    this.refresh();
  }

  private listen(): void {
    this.eventLog.onEvent((entry) => {
      if (entry.major && this.visible) this.refresh();
    });
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
    const entries = this.eventLog.entries.filter((entry) => entry.major);
    this.content.innerHTML = entries.length
      ? `<div class="chronicle-line"></div>${entries
          .map((entry, index) => `<article class="chronicle-entry">
            <div class="chronicle-dot">${index + 1}</div>
            <time>${entry.timeLabel}</time>
            <p>${escapeHtml(entry.text)}</p>
          </article>`)
          .join('')}`
      : '<div class="empty-story">この村の歴史は、まだ白紙だ。</div>';
  }
}
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
