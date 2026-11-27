// Author: a
import type { PlanBlock, RiskLevel } from "../../src/shared/types";
import { canSendMessage, sendMessageToHost, showToast } from "../core/bridge";
import {
  appendInlineFormattedText,
  createCommentInlineControl,
  createFileRefElement,
} from "../core/format";
import type { CardStateStore } from "../state/store";

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const RISK_TONE: Record<RiskLevel, string> = {
  low: "good",
  medium: "warn",
  high: "bad",
};

export function buildPlanBlock(
  block: PlanBlock,
  options: {
    store: CardStateStore;
    blockKey: string;
    cardCommentable?: boolean;
  },
): HTMLElement {
  const state = options.store.getState();
  const commentable = block.commentable ?? options.cardCommentable ?? true;

  if (!state.checkedPlans[options.blockKey]) {
    const initial = new Set<string>();
    block.steps.forEach((step, idx) => {
      const id = step.id ?? `step-${idx + 1}`;
      if (step.defaultChecked ?? !step.optional) {
        initial.add(id);
      }
    });
    state.checkedPlans[options.blockKey] = initial;
  }

  const checkedSet = state.checkedPlans[options.blockKey];

  const section = document.createElement("section");
  section.className = "vw-plan";

  if (block.title) {
    const heading = document.createElement("div");
    heading.className = "vw-section-title";
    heading.textContent = block.title;
    section.appendChild(heading);
  }

  const list = document.createElement("div");
  list.className = "vw-plan-list";

  const footer = document.createElement("div");
  footer.className = "vw-actions";

  const updateFooter = () => {
    footer.replaceChildren();
    const picked = block.steps.filter((step, idx) =>
      checkedSet.has(step.id ?? `step-${idx + 1}`),
    );
    const skipped = block.steps.filter(
      (step, idx) => !checkedSet.has(step.id ?? `step-${idx + 1}`),
    );

    if (picked.length === 0) return;

    const lines = [
      `批准实施以下 ${picked.length} 个步骤：`,
      ...picked.map((s, i) => `${i + 1}. ${s.title}`),
    ];
    if (skipped.length > 0) {
      lines.push(`跳过以下步骤：${skipped.map((s) => s.title).join("、")}`);
    }
    const instruction = lines.join("\n");

    const queueBtn = document.createElement("button");
    queueBtn.type = "button";
    queueBtn.className = "vw-action-btn vw-action-secondary";
    queueBtn.textContent = `暂存勾选 (${picked.length}/${block.steps.length})`;
    queueBtn.addEventListener("click", () => {
      options.store.upsertQueueItem({
        key: `${options.blockKey}:plan-approval`,
        label: `批准 ${picked.length} 步计划`,
        text: instruction,
      });
      showToast("已将勾选计划加入暂存队列");
    });
    footer.appendChild(queueBtn);

    if (canSendMessage()) {
      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.className = "vw-action-btn vw-action-primary";
      approveBtn.textContent = `${block.submitLabel ?? "批准并执行"} (${picked.length}/${block.steps.length})`;
      approveBtn.addEventListener("click", async () => {
        const composed = options.store.buildComposedReply(instruction);
        approveBtn.disabled = true;
        approveBtn.textContent = "发送中…";
        const ok = await sendMessageToHost(composed);
        if (ok) {
          await options.store.clearAllFeedback();
          showToast("已发送计划批准指令到对话");
          approveBtn.textContent = "✓ 已发送";
          window.setTimeout(() => {
            approveBtn.disabled = false;
            updateFooter();
          }, 1500);
        } else {
          approveBtn.disabled = false;
          updateFooter();
        }
      });
      footer.appendChild(approveBtn);
    }
  };

  block.steps.forEach((step, idx) => {
    const stepId = step.id ?? `step-${idx + 1}`;
    const itemEl = document.createElement("div");
    itemEl.className = checkedSet.has(stepId) ? "vw-plan-item" : "vw-plan-item is-unchecked";

    const top = document.createElement("div");
    top.className = "vw-plan-head";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "vw-checkbox";
    checkbox.checked = checkedSet.has(stepId);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) checkedSet.add(stepId);
      else checkedSet.delete(stepId);
      itemEl.classList.toggle("is-unchecked", !checkbox.checked);
      updateFooter();
    });
    top.appendChild(checkbox);

    const title = document.createElement("span");
    title.className = "vw-plan-title";
    title.textContent = `${idx + 1}. ${step.title}`;
    top.appendChild(title);

    if (step.optional) {
      const optBadge = document.createElement("span");
      optBadge.className = "vw-badge vw-badge-neutral";
      optBadge.textContent = "可选";
      top.appendChild(optBadge);
    }

    if (step.risk) {
      const riskBadge = document.createElement("span");
      riskBadge.className = `vw-badge vw-badge-${RISK_TONE[step.risk]}`;
      const dot = document.createElement("span");
      dot.className = "vw-badge-dot";
      const txt = document.createElement("span");
      txt.textContent = RISK_LABEL[step.risk];
      riskBadge.append(dot, txt);
      top.appendChild(riskBadge);
    }

    if (step.estimate) {
      const est = document.createElement("span");
      est.className = "vw-plan-est";
      est.textContent = step.estimate;
      top.appendChild(est);
    }

    let commentEditor: HTMLElement | null = null;
    if (commentable) {
      const commentKey = `${options.blockKey}:plan-${stepId}`;
      const label = `计划步骤 ${idx + 1} (${step.title})`;
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
      top.appendChild(ctrl.trigger);
      commentEditor = ctrl.editor;
    }

    itemEl.appendChild(top);

    if (step.detail) {
      const detail = document.createElement("div");
      detail.className = "vw-plan-detail";
      appendInlineFormattedText(detail, step.detail);
      itemEl.appendChild(detail);
    }

    if (step.files && step.files.length > 0) {
      const filesRow = document.createElement("div");
      filesRow.className = "vw-plan-files";
      for (const f of step.files) {
        const el = createFileRefElement(f.fileRef, f.fileUri, undefined, undefined, true);
        if (el) filesRow.appendChild(el);
      }
      itemEl.appendChild(filesRow);
    }

    if (commentEditor) {
      itemEl.appendChild(commentEditor);
    }

    list.appendChild(itemEl);
  });

  updateFooter();
  section.append(list, footer);
  return section;
}
