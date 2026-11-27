// Author: a
import {
  collectDraftEntries,
  composeReply,
  type QueuedFeedbackItem,
} from "../../src/shared/reply";
import type { CardDraft, Severity, StoredPayload } from "../../src/shared/types";
import {
  callAppServerTool,
  enqueueDraftPersist,
  syncModelContextToHost,
} from "../core/bridge";

export interface CardUiState {
  cardId: string;
  queued: QueuedFeedbackItem[];
  comments: Record<string, { label: string; text: string }>;
  customNote: string;
  openCommentKeys: Set<string>;
  activeTabs: Record<string, string>;
  decisionWeights: Record<string, number[]>;
  findingSeverity: Record<string, Severity | "all">;
  selectedFindings: Record<string, Set<string>>;
  checkedPlans: Record<string, Set<string>>;
  selectedMermaidNode: Record<string, string | null>;
  contextSynced: boolean;
}

type Listener = () => void;

export class CardStateStore {
  private states = new Map<string, CardUiState>();
  private currentCardId = "";
  private listeners = new Set<Listener>();
  private persistTimer: number | undefined;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * 绑定当前渲染卡片：若已有同 cardId 内存状态（例如主题切换重渲染），无损保留。
   * 绝不在加载阶段自动调用 updateModelContext（严格遵循用户显式动作触发规范）。
   */
  activateCard(payload: StoredPayload): CardUiState {
    this.currentCardId = payload.cardId;
    let state = this.states.get(payload.cardId);
    if (!state) {
      const draft: CardDraft | undefined = payload.draft;
      state = {
        cardId: payload.cardId,
        queued: draft?.queued ? draft.queued.map((q) => ({ ...q })) : [],
        comments: draft?.comments ? { ...draft.comments } : {},
        customNote: draft?.customNote ?? "",
        openCommentKeys: new Set<string>(),
        activeTabs: {},
        decisionWeights: {},
        findingSeverity: {},
        selectedFindings: {},
        checkedPlans: {},
        selectedMermaidNode: {},
        contextSynced: false,
      };
      this.states.set(payload.cardId, state);
    }
    return state;
  }

  getState(): CardUiState {
    const existing = this.states.get(this.currentCardId);
    if (existing) return existing;
    const fallback: CardUiState = {
      cardId: this.currentCardId || "ephemeral",
      queued: [],
      comments: {},
      customNote: "",
      openCommentKeys: new Set(),
      activeTabs: {},
      decisionWeights: {},
      findingSeverity: {},
      selectedFindings: {},
      checkedPlans: {},
      selectedMermaidNode: {},
      contextSynced: false,
    };
    this.states.set(fallback.cardId, fallback);
    return fallback;
  }

  getFeedbackEntries() {
    const state = this.getState();
    return collectDraftEntries({
      queued: state.queued,
      comments: state.comments,
      customNote: state.customNote,
    });
  }

  buildComposedReply(finalText?: string | null): string {
    const entries = this.getFeedbackEntries();
    return composeReply(
      entries.map((e) => e.text),
      finalText,
    );
  }

  isQueued(key: string): boolean {
    return this.getState().queued.some((item) => item.key === key);
  }

  toggleQueueItem(item: QueuedFeedbackItem): boolean {
    const state = this.getState();
    const idx = state.queued.findIndex((q) => q.key === item.key);
    let added: boolean;
    if (idx >= 0) {
      state.queued.splice(idx, 1);
      added = false;
    } else {
      state.queued.push({ ...item });
      added = true;
    }
    this.onUserFeedbackChanged();
    return added;
  }

  upsertQueueItem(item: QueuedFeedbackItem): void {
    const state = this.getState();
    const idx = state.queued.findIndex((q) => q.key === item.key);
    if (idx >= 0) {
      state.queued[idx] = { ...item };
    } else {
      state.queued.push({ ...item });
    }
    this.onUserFeedbackChanged();
  }

  setComment(key: string, label: string, text: string): void {
    const state = this.getState();
    const trimmed = text.trim();
    if (!trimmed) {
      delete state.comments[key];
    } else {
      state.comments[key] = { label, text: trimmed };
    }
    this.onUserFeedbackChanged();
  }

  setCustomNote(text: string): void {
    const state = this.getState();
    state.customNote = text;
    this.onUserFeedbackChanged();
  }

  removeFeedbackEntry(entryId: string): void {
    const state = this.getState();
    if (entryId.startsWith("queue:")) {
      const key = entryId.slice("queue:".length);
      state.queued = state.queued.filter((q) => q.key !== key);
    } else if (entryId.startsWith("comment:")) {
      const key = entryId.slice("comment:".length);
      delete state.comments[key];
    } else if (entryId === "custom:note") {
      state.customNote = "";
    }
    this.onUserFeedbackChanged();
  }

  async clearAllFeedback(): Promise<void> {
    const state = this.getState();
    state.queued = [];
    state.comments = {};
    state.customNote = "";
    state.contextSynced = false;
    await syncModelContextToHost("");
    this.scheduleDraftPersist();
    this.emit();
  }

  private onUserFeedbackChanged(): void {
    const composed = this.buildComposedReply();
    void syncModelContextToHost(composed).then((ok) => {
      const state = this.getState();
      const nextSynced = ok && composed.length > 0;
      if (state.contextSynced !== nextSynced) {
        state.contextSynced = nextSynced;
        this.emit();
      }
    });
    this.scheduleDraftPersist();
    this.emit();
  }

  private scheduleDraftPersist(): void {
    const cardId = this.currentCardId;
    if (!cardId || cardId.startsWith("gallery:")) return;

    if (this.persistTimer !== undefined) {
      window.clearTimeout(this.persistTimer);
    }
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = undefined;
      const state = this.states.get(cardId);
      if (!state) return;
      const snapshot = {
        cardId,
        queued: state.queued.map((q) => ({ ...q })),
        comments: { ...state.comments },
        customNote: state.customNote,
      };
      enqueueDraftPersist(async () => {
        await callAppServerTool("app_save_draft", snapshot);
      });
    }, 300);
  }
}
