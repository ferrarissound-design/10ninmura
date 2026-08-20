import { CONFIG } from '../config';

export function hourOfTick(tick: number): number {
  const minutesOfDay = Math.floor(tick) % (24 * 60);
  return minutesOfDay / 60;
}

export function isNight(tick: number): boolean {
  const h = hourOfTick(tick);
  return h >= CONFIG.time.nightHourStart || h < CONFIG.time.nightHourEnd;
}

export function dayIndex(tick: number): number {
  return Math.floor(Math.floor(tick) / (24 * 60));
}

// 0=深夜, 1=真昼 の明るさ係数 (日の出/日の入りで滑らかに補間)
export function daylightFactor(tick: number): number {
  const h = hourOfTick(tick);
  const sunrise = CONFIG.time.nightHourEnd;
  const sunset = CONFIG.time.nightHourStart;
  const fadeHours = 1.5;
  if (h < sunrise - fadeHours || h > sunset + fadeHours) return 0;
  if (h < sunrise + fadeHours) return clamp01((h - (sunrise - fadeHours)) / (fadeHours * 2));
  if (h > sunset - fadeHours) return clamp01(((sunset + fadeHours) - h) / (fadeHours * 2));
  return 1;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
