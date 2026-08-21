import type { Npc } from '../npc/Npc';
import type { VillageIncident } from '../types';
import type { RelationshipMatrix } from './relationships';

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
export function initializeVillageRoles(npcs: Npc[]): void {
  const mayor = [...npcs].sort(
    (a, b) =>
      b.personality.honesty + b.personality.kindness + b.personality.sociability -
      (a.personality.honesty + a.personality.kindness + a.personality.sociability),
  )[0];
  if (mayor) mayor.socialStatus.roles = ['mayor'];
}

export function updateSocialStanding(
  npcs: Npc[],
  relationships: RelationshipMatrix,
  incident: VillageIncident | null,
): void {
  const scores = npcs.map((npc) => {
    const incoming = npcs.filter((other) => other.id !== npc.id).map((other) => relationships.get(other.id, npc.id));
    const affection = average(incoming.map((edge) => edge.affection));
    const trust = average(incoming.map((edge) => edge.trust));
    const grudge = average(incoming.map((edge) => edge.grudge));
    npc.socialStatus.reputation = Math.max(-100, Math.min(100, affection * 0.4 + trust * 0.55 - grudge * 0.25));
    npc.socialStatus.roles = npc.socialStatus.roles.filter((role) => role === 'mayor');
    return { npc, affection, trust, reputation: npc.socialStatus.reputation };
  });

  if (!scores.length) return;
  const mostPopular = [...scores].sort((a, b) => b.affection - a.affection)[0];
  const mostTrusted = [...scores].sort((a, b) => b.trust - a.trust)[0];
  const leastEstablished = [...scores].sort((a, b) => a.reputation - b.reputation)[0];
  if (mostPopular.affection >= 15) mostPopular.npc.socialStatus.roles.push('popular');
  if (mostTrusted.trust >= 15) mostTrusted.npc.socialStatus.roles.push('trusted');
  if (leastEstablished.reputation <= -12) leastEstablished.npc.socialStatus.roles.push('outcast');

  if (incident && incident.phase !== 'resolved') {
    const accusationCounts = new Map<string, number>();
    for (const testimony of incident.testimonies.filter((item) => item.shared)) {
      accusationCounts.set(testimony.suspectId, (accusationCounts.get(testimony.suspectId) ?? 0) + 1);
    }
    const mostSuspected = [...accusationCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (mostSuspected && mostSuspected[1] >= 1) {
      npcs.find((npc) => npc.id === mostSuspected[0])?.socialStatus.roles.push('suspect');
    }
  }
}
