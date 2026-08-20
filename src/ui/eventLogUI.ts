import type { EventLog } from '../sim/eventLog';
import type { EventLogEntry } from '../types';

export function initEventLogUI(eventLog: EventLog): void {
  const container = document.getElementById('event-log')!;
  container.innerHTML = '';

  const render = (entry: EventLogEntry) => {
    const div = document.createElement('div');
    div.className = 'log-entry' + (entry.major ? ' major' : '');
    div.innerHTML = `<span class="t">${entry.timeLabel}</span>${escapeHtml(entry.text)}`;
    container.appendChild(div);
    while (container.children.length > 200) {
      container.removeChild(container.firstChild!);
    }
  };

  for (const entry of eventLog.entries) render(entry);
  eventLog.onEvent(render);
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
