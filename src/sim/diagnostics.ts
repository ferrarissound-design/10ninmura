import { World } from './World';

export interface SimulationDiagnostics {
  ok: boolean;
  seed: number;
  days: number;
  checks: number;
  issues: string[];
  summary: {
    events: number;
    majorEvents: number;
    incidents: number;
    couples: number;
    rumors: number;
  };
}

export function runSimulationDiagnostics(days = 30, seed = 123456789): SimulationDiagnostics {
  const world = new World(seed);
  const issues: string[] = [];
  let checks = 0;
  const totalMinutes = days * 24 * 60;

  for (let minute = 0; minute < totalMinutes; minute++) {
    world.update(0.25); // ×1では0.25実秒 = 1ゲーム内分
    if (minute % 60 === 0) checks += validateWorld(world, issues, `開始から${minute}分`);
  }

  const serialized = JSON.stringify(world.toSnapshot());
  const restored = World.fromSnapshot(JSON.parse(serialized));
  checks++;
  if (JSON.stringify(restored.toSnapshot()) !== serialized) {
    issues.push('保存直後と復元直後の世界状態が一致しません。');
  }

  const summary = {
    events: world.eventLog.entries.length,
    majorEvents: world.eventLog.majorEntries.length,
    incidents: world.incidentHistory.length,
    couples: world.npcs.filter((npc) => npc.romance.stage === 'dating').length / 2,
    rumors: world.npcs.reduce(
      (total, npc) => total + npc.memory.filter((memory) => memory.fromRumor).length,
      0,
    ),
  };

  for (let minute = 0; minute < 24 * 60; minute++) {
    world.update(0.25);
    restored.update(0.25);
  }
  checks++;
  if (JSON.stringify(restored.toSnapshot()) !== JSON.stringify(world.toSnapshot())) {
    issues.push('保存から復元した村が、継続後に元の村と異なる結果になりました。');
  }

  const comparisonA = new World(seed);
  const comparisonB = new World(seed);
  for (let minute = 0; minute < 3 * 24 * 60; minute++) {
    comparisonA.update(0.25);
    comparisonB.update(0.25);
  }
  checks++;
  if (JSON.stringify(comparisonA.toSnapshot()) !== JSON.stringify(comparisonB.toSnapshot())) {
    issues.push('同じシードと経過時間から同じ結果を再現できません。');
  }

  return {
    ok: issues.length === 0,
    seed,
    days,
    checks,
    issues,
    summary,
  };
}

function validateWorld(world: World, issues: string[], label: string): number {
  let checks = 0;
  const addIssue = (message: string): void => {
    if (issues.length < 30 && !issues.includes(message)) issues.push(message);
  };

  checks++;
  if (!Number.isFinite(world.tick)) addIssue(`${label}: 時刻が不正です。`);

  for (const npc of world.npcs) {
    checks++;
    if (!Number.isFinite(npc.position.x) || !Number.isFinite(npc.position.z)) {
      addIssue(`${label}: ${npc.name}の位置が不正です。`);
    }
    for (const [need, value] of Object.entries(npc.needs)) {
      checks++;
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        addIssue(`${label}: ${npc.name}の${need}が範囲外です。`);
      }
    }
    if (npc.romance.stage === 'dating' && npc.romance.targetId) {
      checks++;
      const partner = world.getNpc(npc.romance.targetId);
      if (partner?.romance.stage !== 'dating' || partner.romance.targetId !== npc.id) {
        addIssue(`${label}: ${npc.name}の交際関係が相互になっていません。`);
      }
    }

    for (const [otherId, edge] of world.relationships.rowFor(npc.id)) {
      checks += 5;
      const values = [edge.affection, edge.trust, edge.romance, edge.jealousy, edge.grudge];
      if (values.some((value) => !Number.isFinite(value))) {
        addIssue(`${label}: ${npc.id}→${otherId}の関係値が不正です。`);
      }
      if (edge.affection < -100 || edge.affection > 100 || edge.trust < -100 || edge.trust > 100) {
        addIssue(`${label}: ${npc.id}→${otherId}の好感・信頼が範囲外です。`);
      }
      if ([edge.romance, edge.jealousy, edge.grudge].some((value) => value < 0 || value > 100)) {
        addIssue(`${label}: ${npc.id}→${otherId}の恋愛・嫉妬・恨みが範囲外です。`);
      }
    }
  }

  checks++;
  const unresolvedPast = world.incidentHistory.filter(
    (incident) => incident.phase !== 'resolved' && incident.id !== world.activeIncident?.id,
  );
  if (unresolvedPast.length) addIssue(`${label}: 終了していない過去事件があります。`);
  return checks;
}
