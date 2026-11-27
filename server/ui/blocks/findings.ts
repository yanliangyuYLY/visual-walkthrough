// Author: a
import type { FindingItem, FindingsBlock, Severity } from "../../src/shared/types";
import { canSendMessage, sendMessageToHost, showToast } from "../core/bridge";
import {
  appendInlineFormattedText,
  createCommentInlineControl,
  createFileRefElement,
} from "../core/format";
import type { CardStateStore } from "../state/store";
import { buildDiffTableElement } from "./diff";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "严重",
  high: "高危",
  medium: "中危",
  low: "低危",
  info: "提示",
};

function severityToTone(sev: Severity): string {
  if (sev === "critical" || sev === "high") return "bad";
  if (sev === "medium") return "warn";
  if (sev === "low") return "neutral";
  return "info";
}

function looksLikeDiff(text: string): boolean {
  return (
    text.includes("@@ ") ||
    (text.includes("\n+") && text.includes("\n-")) ||
    text.startsWith("--- ")
  );
}

function formatFindingSummary(item: FindingItem): string {
  const loc = item.fileRef
    ? ` (${item.fileRef}${item.line && !item.fileRef.includes(":") ? `:${item.line}` : ""})`
    : "";
  return `[${SEVERITY_LABEL[item.severity]}] ${item.title}${loc}`;
}

export function buildFindingsBlock(
  block: FindingsBlock,
  options: {
    store: CardStateStore;
    blockKey: string;
    cardCommentable?: boolean;
  },
): HTMLElement {
  const state = options.store.getState();
  const selectable = block.selectable ?? true;
  const commentable = block.commentable ?? options.cardCommentable ?? false;

  if (!state.selectedFindings[options.blockKey]) {
    const initial = new Set<string>();
    block.items.forEach((item, idx) => {
      const id = item.id ?? `finding-${idx + 1}`;
      if (item.defaultSelected) initial.add(id);
    });
    state.selectedFindings[options.blockKey] = initial;
  }

  const selectedSet = state.selectedFindings[options.blockKey];
  const section = document.createElement("section");
  section.className = "vw-findings";

  const renderInner = () => {
    section.replaceChildren();
    const activeFilter = state.findingSeverity[options.blockKey] ?? "all";

    const header = document.createElement("div");
    header.className = "vw-section-head";

    if (block.title) {
      const heading = document.createElement("div");
      heading.className = "vw-section-title";
      heading.textContent = block.title;
      header.appendChild(heading);
    }

    // 严重度筛选胶囊
    const counts = new Map<Severity, number>();
    for (const item of block.items) {
      counts.set(item.severity, (counts.get(item.severity) ?? 0) + 1);
    }

    const filterRow = document.createElement("div");
    filterRow.className = "vw-filter-pills";

    const allBtn = document.createElement("button");
    allBtn.type = "button";
    allBtn.className = activeFilter === "all" ? "vw-filter-pill is-active" : "vw-filter-pill";
    allBtn.textContent = `全部 ${block.items.length}`;
    allBtn.addEventListener("click", () => {
      state.findingSeverity[options.blockKey] = "all";
      renderInner();
    });
    filterRow.appendChild(allBtn);

    for (const sev of SEVERITY_ORDER) {
      const cnt = counts.get(sev) ?? 0;
      if (cnt === 0) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        activeFilter === sev
          ? `vw-filter-pill is-active vw-pill-${severityToTone(sev)}`
          : "vw-filter-pill";
      btn.textContent = `${SEVERITY_LABEL[sev]} ${cnt}`;
      btn.addEventListener("click", () => {
        state.findingSeverity[options.blockKey] = sev;
        renderInner();
      });
      filterRow.appendChild(btn);
    }

    header.appendChild(filterRow);
    section.appendChild(header);

    const visibleItems =
      activeFilter === "all"
        ? block.items
        : block.items.filter((item) => item.severity === activeFilter);

    const list = document.createElement("div");
    list.className = "vw-findings-list";

    visibleItems.forEach((item, idx) => {
      const itemId = item.id ?? `finding-${idx + 1}`;
      const card = document.createElement("div");
      card.className = "vw-finding-item";

      const head = document.createElement("div");
      head.className = "vw-finding-head";

      if (selectable) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "vw-checkbox";
        checkbox.checked = selectedSet.has(itemId);
        checkbox.title = "勾选以纳入本次修复";
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) selectedSet.add(itemId);
          else selectedSet.delete(itemId);
          updateFooter();
        });
        head.appendChild(checkbox);
      }

      const sevBadge = document.createElement("span");
      sevBadge.className = `vw-badge vw-badge-${severityToTone(item.severity)}`;
      const dot = document.createElement("span");
      dot.className = "vw-badge-dot";
      const sevText = document.createElement("span");
      sevText.textContent = SEVERITY_LABEL[item.severity];
      sevBadge.append(dot, sevText);
      head.appendChild(sevBadge);

      const titleEl = document.createElement("span");
      titleEl.className = "vw-finding-title";
      titleEl.textContent = item.title;
      head.appendChild(titleEl);

      if (item.rule) {
        const ruleCode = document.createElement("code");
        ruleCode.className = "vw-inline-code";
        ruleCode.textContent = item.rule;
        head.appendChild(ruleCode);
      }

      const fileEl = createFileRefElement(item.fileRef, item.fileUri, item.line, undefined, true);
      if (fileEl) {
        head.appendChild(fileEl);
      }

      let commentEditor: HTMLElement | null = null;
      if (commentable) {
        const commentKey = `${options.blockKey}:finding-${itemId}`;
        const label = item.title;
        const ctrl = createCommentInlineControl({
          commentKey,
          label,
          initialText: state.comments[commentKey]?.text ?? "",
          initiallyOpen: state.openCommentKeys.has(commentKey),
          onToggleOpen: (open) => {
            if (open) state.openCommentKeys.add(commentKey);
            else state.openCommentKeys.delete(commentKey);
          },
          onSave: (text) => options.store.setComment(commentKey, label, text),
        });
        head.appendChild(ctrl.trigger);
        commentEditor = ctrl.editor;
      }

      card.appendChild(head);

      if (item.detail) {
        const detail = document.createElement("div");
        detail.className = "vw-finding-detail";
        appendInlineFormattedText(detail, item.detail);
        card.appendChild(detail);
      }

      if (item.fix) {
        const fixWrap = document.createElement("details");
        fixWrap.className = "vw-finding-fix";
        const sum = document.createElement("summary");
        sum.textContent = "查看建议修复";
        fixWrap.appendChild(sum);

        if (item.fixIsDiff || looksLikeDiff(item.fix)) {
          fixWrap.appendChild(buildDiffTableElement(item.fix).el);
        } else {
          const pre = document.createElement("pre");
          pre.className = "vw-source-pre";
          pre.textContent = item.fix;
          fixWrap.appendChild(pre);
        }
        card.appendChild(fixWrap);
      }

      if (commentEditor) {
        card.appendChild(commentEditor);
      }

      list.appendChild(card);
    });

    section.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "vw-actions";

    const updateFooter = () => {
      footer.replaceChildren();
      if (!selectable) return;
      const picked = block.items.filter((item, idx) =>
        selectedSet.has(item.id ?? `finding-${idx + 1}`),
      );
      if (picked.length === 0) return;

      const instruction = `请修复以下 ${picked.length} 项已勾选的问题：\n${picked
        .map((item, i) => `${i + 1}. ${formatFindingSummary(item)}`)
        .join("\n")}`;

      const queueBtn = document.createElement("button");
      queueBtn.type = "button";
      queueBtn.className = "vw-action-btn vw-action-secondary";
      queueBtn.textContent = `暂存已选 (${picked.length})`;
      queueBtn.addEventListener("click", () => {
        options.store.upsertQueueItem({
          key: `${options.blockKey}:picked-findings`,
          label: `修复 ${picked.length} 项问题`,
          text: instruction,
        });
        showToast(`已将 ${picked.length} 项修复任务加入暂存队列`);
      });
      footer.appendChild(queueBtn);

      if (canSendMessage()) {
        const sendBtn = document.createElement("button");
        sendBtn.type = "button";
        sendBtn.className = "vw-action-btn vw-action-primary";
        sendBtn.textContent = `${block.submitLabel ?? "修复已选问题"} (${picked.length})`;
        sendBtn.addEventListener("click", async () => {
          const composed = options.store.buildComposedReply(instruction);
          sendBtn.disabled = true;
          sendBtn.textContent = "发送中…";
          const ok = await sendMessageToHost(composed);
          if (ok) {
            await options.store.clearAllFeedback();
            showToast("已发送修复指令到对话");
            sendBtn.textContent = "✓ 已发送";
            window.setTimeout(() => {
              sendBtn.disabled = false;
              updateFooter();
            }, 1500);
          } else {
            sendBtn.disabled = false;
            updateFooter();
          }
        });
        footer.appendChild(sendBtn);
      }
    };

    updateFooter();
    section.appendChild(footer);
  };

  renderInner();
  return section;
}
