import type { Gender } from '../types';

export const MALE_NAMES = [
  'ケン', 'ユウ', 'タカシ', 'ダイ', 'ソウタ', 'ハルト', 'リョウ', 'ケイ', 'シン', 'ゴウ',
  'アキラ', 'ジン', 'コウ', 'ツバサ', 'カイ',
];

export const FEMALE_NAMES = [
  'ミカ', 'アヤ', 'ユキ', 'サキ', 'ナナ', 'リン', 'ホノカ', 'マイ', 'ソラ', 'ハナ',
  'エマ', 'ツバキ', 'イロハ', 'メイ', 'コトネ',
];

export function pickName(
  gender: Gender,
  usedNames: Set<string>,
  rng: { pick<T>(arr: readonly T[]): T },
): string {
  const pool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  const available = pool.filter((n) => !usedNames.has(n));
  const name = available.length > 0 ? rng.pick(available) : rng.pick(pool) + '2';
  usedNames.add(name);
  return name;
}
