import { CONFIG } from '../config';
import type { EventLogEntry, NpcId } from '../types';

export type EventListener = (entry: EventLogEntry) => void;

export class EventLog {
  entries: EventLogEntry[] = [];
  private listeners: EventListener[] = [];
  private counter = 0;

  onEvent(listener: EventListener): void {
    this.listeners.push(listener);
  }

  push(tick: number, text: string, npcIds: NpcId[], major = false): EventLogEntry {
    const entry: EventLogEntry = {
      id: `evt_${this.counter++}`,
      tick,
      timeLabel: formatTime(tick),
      text,
      major,
      npcIds,
    };
    this.entries.push(entry);
    if (this.entries.length > CONFIG.debug.logHistoryLimit) {
      this.entries.shift();
    }
    for (const l of this.listeners) l(entry);
    return entry;
  }
}

export function formatTime(tickMinutes: number): string {
  const totalMinutes = Math.floor(tickMinutes);
  const day = Math.floor(totalMinutes / (24 * 60)) + 1;
  const minutesOfDay = totalMinutes % (24 * 60);
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  return `${day}日目 ${hh}:${mm}`;
}

export function formatClockOnly(tickMinutes: number): { time: string; day: number } {
  const totalMinutes = Math.floor(tickMinutes);
  const day = Math.floor(totalMinutes / (24 * 60)) + 1;
  const minutesOfDay = totalMinutes % (24 * 60);
  const h = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  return { time: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, day };
}
