// Author: a
import fs from "node:fs/promises";
import path from "node:path";
import type { CardDraft, HistorySummary, StoredPayload } from "./shared/types";

const MAX_HISTORY_ITEMS = 30;
const MAX_DRAFT_ITEMS = 40;

interface PersistedHistoryFile {
  version: 1;
  items: StoredPayload[];
}

interface PersistedDraftsFile {
  version: 1;
  drafts: Record<string, CardDraft>;
}

function stripTransientFields(payload: StoredPayload): StoredPayload {
  const copy = { ...payload };
  delete copy.history;
  delete copy.draft;
  delete copy.surfaceHint;
  return copy;
}

export class PluginStorage {
  private readonly dataDir: string | null;
  private initialized = false;
  private history: StoredPayload[] = [];
  private drafts: Record<string, CardDraft> = {};
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dataDir?: string | null) {
    const trimmed = dataDir?.trim();
    this.dataDir = trimmed ? path.resolve(trimmed) : null;
  }

  get persistent(): boolean {
    return this.dataDir !== null;
  }

  private get historyPath(): string | null {
    return this.dataDir ? path.join(this.dataDir, "history.json") : null;
  }

  private get draftsPath(): string | null {
    return this.dataDir ? path.join(this.dataDir, "drafts.json") : null;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.dataDir) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const [hRaw, dRaw] = await Promise.all([
        this.readJsonSafe<PersistedHistoryFile>(this.historyPath!),
        this.readJsonSafe<PersistedDraftsFile>(this.draftsPath!),
      ]);

      if (hRaw && Array.isArray(hRaw.items)) {
        this.history = hRaw.items
          .filter((item): item is StoredPayload => Boolean(item && typeof item.cardId === "string" && typeof item.title === "string"))
          .slice(0, MAX_HISTORY_ITEMS);
      }

      if (dRaw && dRaw.drafts && typeof dRaw.drafts === "object") {
        this.drafts = dRaw.drafts;
      }
    } catch {
      // 持久化目录异常时优雅降级为纯内存模式，不阻断 MCP 服务
    }
  }

  private async readJsonSafe<T>(filePath: string): Promise<T | null> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  private async writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), { encoding: "utf-8", mode: 0o600 });
    await fs.rename(tmp, filePath);
  }

  private enqueuePersist(task: () => Promise<void>): Promise<void> {
    if (!this.dataDir) return Promise.resolve();
    this.writeQueue = this.writeQueue.then(task).catch(() => {
      // 忽略单次磁盘写错，保持后续队列不中断
    });
    return this.writeQueue;
  }

  async saveCard(payload: StoredPayload): Promise<void> {
    await this.init();
    const clean = stripTransientFields(payload);
    this.history = [
      clean,
      ...this.history.filter((item) => item.cardId !== clean.cardId),
    ].slice(0, MAX_HISTORY_ITEMS);

    await this.enqueuePersist(async () => {
      if (!this.historyPath) return;
      const body: PersistedHistoryFile = { version: 1, items: this.history };
      await this.writeJsonAtomic(this.historyPath, body);
    });
  }

  async getLatestCard(): Promise<StoredPayload | null> {
    await this.init();
    const first = this.history[0];
    if (!first) return null;
    return this.attachDraft(first);
  }

  async getCardById(cardId: string): Promise<StoredPayload | null> {
    await this.init();
    const found = this.history.find((item) => item.cardId === cardId);
    if (!found) return null;
    return this.attachDraft(found);
  }

  async listHistory(): Promise<HistorySummary[]> {
    await this.init();
    return this.history.map((item) => ({
      cardId: item.cardId,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      createdAt: item.createdAt,
    }));
  }

  async saveDraft(draft: CardDraft): Promise<void> {
    await this.init();
    const isEmpty =
      draft.queued.length === 0 &&
      Object.keys(draft.comments).length === 0 &&
      draft.customNote.trim().length === 0;

    if (isEmpty) {
      delete this.drafts[draft.cardId];
    } else {
      this.drafts[draft.cardId] = draft;
      const keys = Object.keys(this.drafts);
      if (keys.length > MAX_DRAFT_ITEMS) {
        const sorted = keys.sort(
          (a, b) => (this.drafts[b]?.updatedAt ?? 0) - (this.drafts[a]?.updatedAt ?? 0),
        );
        for (const staleKey of sorted.slice(MAX_DRAFT_ITEMS)) {
          delete this.drafts[staleKey];
        }
      }
    }

    await this.enqueuePersist(async () => {
      if (!this.draftsPath) return;
      const body: PersistedDraftsFile = { version: 1, drafts: this.drafts };
      await this.writeJsonAtomic(this.draftsPath, body);
    });
  }

  private attachDraft(card: StoredPayload): StoredPayload {
    const draft = this.drafts[card.cardId];
    return draft ? { ...card, draft } : { ...card };
  }
}

export function parseDataDirArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--data_dir=")) {
      return arg.slice("--data_dir=".length) || undefined;
    }
    if (arg === "--data_dir" && i + 1 < argv.length) {
      return argv[i + 1] || undefined;
    }
  }
  return process.env.WALKTHROUGH_DATA_DIR || undefined;
}
