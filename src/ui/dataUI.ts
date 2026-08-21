import { World } from '../sim/World';

const STORAGE_KEY = '10ninmura.world.v1';

export class VillageDataUI {
  private world: World;
  private overlay = document.getElementById('data-overlay')!;
  private seedInput = document.getElementById('seed-input') as HTMLInputElement;
  private status = document.getElementById('data-status')!;

  constructor(
    world: World,
    private readonly replaceWorld: (world: World, preserveSpeed?: boolean) => void,
  ) {
    this.world = world;
    document.getElementById('btn-data')!.addEventListener('click', () => this.open());
    document.getElementById('data-close')!.addEventListener('click', () => this.close());
    document.getElementById('btn-seed-restart')!.addEventListener('click', () => this.restartFromSeed());
    document.getElementById('btn-save-state')!.addEventListener('click', () => this.save());
    document.getElementById('btn-load-state')!.addEventListener('click', () => this.load());
    document.getElementById('btn-export-chronicle')!.addEventListener('click', () => this.exportChronicle());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.close();
    });
    this.refresh();
  }

  setWorld(world: World): void {
    this.world = world;
    this.refresh();
  }

  private open(): void {
    this.status.textContent = '';
    this.refresh();
    this.overlay.classList.remove('hidden');
    this.seedInput.focus();
  }

  private close(): void {
    this.overlay.classList.add('hidden');
    (document.getElementById('btn-data') as HTMLButtonElement).focus();
  }

  private refresh(): void {
    this.seedInput.value = String(this.world.seed);
  }

  private restartFromSeed(): void {
    const seed = Number(this.seedInput.value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      this.setStatus('0〜4294967295の整数を入力してください。', true);
      return;
    }
    this.replaceWorld(new World(seed));
    this.close();
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.world.toSnapshot()));
      this.setStatus('現在の村をこのブラウザに保存しました。');
    } catch (error) {
      this.setStatus(`保存できませんでした: ${errorMessage(error)}`, true);
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.setStatus('保存された村がありません。', true);
        return;
      }
      const restored = World.fromSnapshot(JSON.parse(raw));
      this.replaceWorld(restored, false);
      this.close();
    } catch (error) {
      this.setStatus(`読み込めませんでした: ${errorMessage(error)}`, true);
    }
  }

  private exportChronicle(): void {
    const lines = [
      `10人村の年代記（シード: ${this.world.seed}）`,
      '',
      ...this.world.eventLog.majorEntries.map((entry) => `${entry.timeLabel}  ${entry.text}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `10ninmura-${this.world.seed}-chronicle.txt`;
    link.click();
    URL.revokeObjectURL(url);
    this.setStatus('年代記を書き出しました。');
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.classList.toggle('error', error);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
