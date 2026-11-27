// Author: a
import type { HistorySummary, StoredPayload } from "../../src/shared/types";
import { callAppServerTool, canCallServerTools, showToast } from "../core/bridge";

interface AppHistoryResponse {
  persistent?: boolean;
  history?: HistorySummary[];
  gallery?: Array<{ id: string; label: string; description: string }>;
}

const FALLBACK_GALLERY = [
  { id: "gallery:walkthrough", label: "示例 · 逻辑讲解（节点联动）", description: "" },
  { id: "gallery:review", label: "示例 · Code Review（Findings + Diff + Tabs）", description: "" },
  { id: "gallery:plan", label: "示例 · 实施计划审批（Plan + Queue）", description: "" },
  { id: "gallery:decision", label: "示例 · 方案加权对比（Decision）", description: "" },
];

export function buildWorkbenchBar(options: {
  currentPayload: StoredPayload;
  onSelectCard: (payload: StoredPayload) => void;
}): HTMLElement | null {
  const { currentPayload, onSelectCard } = options;
  const isAuxSurface =
    currentPayload.surfaceHint === "aux_pane" || currentPayload.cardId.startsWith("gallery:");
  if (!isAuxSurface || !canCallServerTools()) {
    return null;
  }

  let history: HistorySummary[] = currentPayload.history ?? [];
  let gallery = FALLBACK_GALLERY;

  const bar = document.createElement("div");
  bar.className = "vw-workbench-bar";

  const label = document.createElement("span");
  label.className = "vw-workbench-label";
  label.textContent = "工作台";

  const select = document.createElement("select");
  select.className = "vw-workbench-select";
  select.title = "切换历史卡片或内置组件示例（Mini Gallery）";

  const refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "vw-tool-btn";
  refreshBtn.textContent = "刷新";
  refreshBtn.title = "刷新历史卡片列表";

  const populateSelect = () => {
    select.replaceChildren();

    if (history.length > 0) {
      const grpHist = document.createElement("optgroup");
      grpHist.label = `最近卡片（${history.length}）`;
      for (const item of history) {
        const opt = document.createElement("option");
        opt.value = item.cardId;
        const kindTag = item.kind === "ui_card" ? "卡片" : "逻辑";
        opt.textContent = `[${kindTag}] ${item.title}`;
        if (item.cardId === currentPayload.cardId) {
          opt.selected = true;
        }
        grpHist.appendChild(opt);
      }
      select.appendChild(grpHist);
    }

    const grpGallery = document.createElement("optgroup");
    grpGallery.label = "组件示例（Mini Gallery）";
    for (const g of gallery) {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.label;
      if (g.id === currentPayload.cardId) {
        opt.selected = true;
      }
      grpGallery.appendChild(opt);
    }
    select.appendChild(grpGallery);
  };

  const refreshHistory = async (silent = true) => {
    const res = await callAppServerTool<AppHistoryResponse>("app_list_history", {});
    if (!res) return;
    if (Array.isArray(res.history)) history = res.history;
    if (Array.isArray(res.gallery) && res.gallery.length > 0) gallery = res.gallery;
    populateSelect();
    if (!silent) showToast(`已同步 ${history.length} 条历史记录`);
  };

  select.addEventListener("change", async () => {
    const nextId = select.value;
    if (!nextId || nextId === currentPayload.cardId) return;
    select.disabled = true;
    const loaded = await callAppServerTool<StoredPayload>("app_get_card", { cardId: nextId });
    select.disabled = false;
    if (loaded && typeof loaded.title === "string") {
      onSelectCard(loaded);
    } else {
      showToast("加载所选卡片失败");
      populateSelect();
    }
  });

  refreshBtn.addEventListener("click", () => {
    void refreshHistory(false);
  });

  populateSelect();
  bar.append(label, select, refreshBtn);

  // 静默补全最新列表与完整示例清单
  void refreshHistory(true);
  return bar;
}
