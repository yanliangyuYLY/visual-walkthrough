// Author: a
import type { DecisionBlock } from "../../src/shared/types";
import { canSendMessage, sendMessageToHost, showToast } from "../core/bridge";
import { appendInlineFormattedText } from "../core/format";
import type { CardStateStore } from "../state/store";

export function buildDecisionBlock(
  block: DecisionBlock,
  options: { store: CardStateStore; blockKey: string },
): HTMLElement {
  const state = options.store.getState();

  if (
    !state.decisionWeights[options.blockKey] ||
    state.decisionWeights[options.blockKey].length !== block.criteria.length
  ) {
    state.decisionWeights[options.blockKey] = block.criteria.map((c) => c.weight ?? 2);
  }
  const weights = state.decisionWeights[options.blockKey];

  const section = document.createElement("section");
  section.className = "vw-decision";

  // 1. 维度权重调节区（拖动仅重算右侧卡片列表，不重建滑块本身防失焦）
  const slidersBox = document.createElement("div");
  slidersBox.className = "vw-decision-sliders";

  const sliderTitle = document.createElement("div");
  sliderTitle.className = "vw-decision-sliders-title";
  sliderTitle.textContent = "维度权重（拖动滑块本地实时重排，零模型调用）";
  slidersBox.appendChild(sliderTitle);

  const sliderGrid = document.createElement("div");
  sliderGrid.className = "vw-decision-slider-grid";

  const cardsWrap = document.createElement("div");
  cardsWrap.className = "vw-decision-options";

  const renderRankedOptions = () => {
    cardsWrap.replaceChildren();
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

    const ranked = block.options
      .map((opt, origIdx) => {
        let weightedSum = 0;
        block.criteria.forEach((_, cIdx) => {
          const score = opt.scores[cIdx] ?? 0;
          weightedSum += score * (weights[cIdx] ?? 1);
        });
        const avg = weightedSum / totalWeight;
        return { opt, origIdx, avg };
      })
      .sort((a, b) => b.avg - a.avg);

    ranked.forEach(({ opt, avg }, rankIdx) => {
      const isWinner = rankIdx === 0;
      const card = document.createElement("div");
      card.className = isWinner ? "vw-decision-card is-winner" : "vw-decision-card";

      const head = document.createElement("div");
      head.className = "vw-decision-card-head";

      const left = document.createElement("div");
      left.className = "vw-decision-name-wrap";

      const rank = document.createElement("span");
      rank.className = isWinner ? "vw-badge vw-badge-good" : "vw-badge vw-badge-neutral";
      rank.textContent = `#${rankIdx + 1}`;

      const nameEl = document.createElement("span");
      nameEl.className = "vw-decision-name";
      nameEl.textContent = opt.name;

      left.append(rank, nameEl);

      if (opt.recommended) {
        const rec = document.createElement("span");
        rec.className = "vw-badge vw-badge-info";
        rec.textContent = "推荐";
        left.appendChild(rec);
      }

      const scoreEl = document.createElement("span");
      scoreEl.className = "vw-decision-score";
      scoreEl.textContent = `${avg.toFixed(2)} 分`;

      head.append(left, scoreEl);
      card.appendChild(head);

      // 各维度细分条
      const bars = document.createElement("div");
      bars.className = "vw-decision-bars";
      block.criteria.forEach((crit, cIdx) => {
        const score = opt.scores[cIdx] ?? 0;
        const pct = Math.max(0, Math.min(100, (score / 5) * 100));
        const barItem = document.createElement("div");
        barItem.className = "vw-decision-bar-item";
        barItem.title = `${crit.name}：${score}（权重 ${weights[cIdx]}）`;

        const lbl = document.createElement("span");
        lbl.className = "vw-decision-bar-label";
        lbl.textContent = `${crit.name} ${score}`;

        const track = document.createElement("div");
        track.className = "vw-decision-bar-track";
        const fill = document.createElement("div");
        fill.className = "vw-decision-bar-fill";
        fill.style.width = `${pct}%`;
        track.appendChild(fill);

        barItem.append(lbl, track);
        bars.appendChild(barItem);
      });
      card.appendChild(bars);

      if ((opt.pros && opt.pros.length > 0) || (opt.cons && opt.cons.length > 0)) {
        const prosCons = document.createElement("div");
        prosCons.className = "vw-decision-pc";

        if (opt.pros && opt.pros.length > 0) {
          const ul = document.createElement("ul");
          ul.className = "vw-pc-list vw-pc-pros";
          for (const p of opt.pros) {
            const li = document.createElement("li");
            appendInlineFormattedText(li, `+ ${p}`);
            ul.appendChild(li);
          }
          prosCons.appendChild(ul);
        }

        if (opt.cons && opt.cons.length > 0) {
          const ul = document.createElement("ul");
          ul.className = "vw-pc-list vw-pc-cons";
          for (const c of opt.cons) {
            const li = document.createElement("li");
            appendInlineFormattedText(li, `- ${c}`);
            ul.appendChild(li);
          }
          prosCons.appendChild(ul);
        }

        card.appendChild(prosCons);
      }

      if (opt.note) {
        const note = document.createElement("div");
        note.className = "vw-decision-note";
        appendInlineFormattedText(note, opt.note);
        card.appendChild(note);
      }

      // 操作按钮
      const actRow = document.createElement("div");
      actRow.className = "vw-decision-actions";
      const weightSummary = block.criteria
        .map((c, idx) => `${c.name}=${weights[idx]}`)
        .join("、");
      const actionText =
        opt.actionText ??
        `采用「${opt.name}」方案（当前加权得分 ${avg.toFixed(2)}，权重：${weightSummary}）。`;

      const queueBtn = document.createElement("button");
      queueBtn.type = "button";
      queueBtn.className = "vw-tool-btn";
      queueBtn.textContent = "加入暂存";
      queueBtn.addEventListener("click", () => {
        options.store.upsertQueueItem({
          key: `${options.blockKey}:choice`,
          label: `选定 ${opt.name}`,
          text: actionText,
        });
        showToast(`已暂存方案「${opt.name}」`);
      });
      actRow.appendChild(queueBtn);

      if (canSendMessage()) {
        const pickBtn = document.createElement("button");
        pickBtn.type = "button";
        pickBtn.className = isWinner
          ? "vw-action-btn vw-action-primary vw-btn-sm"
          : "vw-action-btn vw-action-secondary vw-btn-sm";
        pickBtn.textContent = isWinner && block.submitLabel ? block.submitLabel : `选择 ${opt.name}`;
        pickBtn.addEventListener("click", async () => {
          const composed = options.store.buildComposedReply(actionText);
          pickBtn.disabled = true;
          pickBtn.textContent = "发送中…";
          const ok = await sendMessageToHost(composed);
          if (ok) {
            await options.store.clearAllFeedback();
            showToast(`已发送方案「${opt.name}」到对话`);
            pickBtn.textContent = "✓ 已选定";
          } else {
            pickBtn.disabled = false;
            pickBtn.textContent = `选择 ${opt.name}`;
          }
        });
        actRow.appendChild(pickBtn);
      }

      card.appendChild(actRow);
      cardsWrap.appendChild(card);
    });
  };

  block.criteria.forEach((crit, cIdx) => {
    const item = document.createElement("label");
    item.className = "vw-slider-item";
    if (crit.note) item.title = crit.note;

    const top = document.createElement("div");
    top.className = "vw-slider-top";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = crit.name;
    const valSpan = document.createElement("span");
    valSpan.className = "vw-slider-val";
    valSpan.textContent = `×${weights[cIdx]}`;
    top.append(nameSpan, valSpan);

    const range = document.createElement("input");
    range.type = "range";
    range.min = "1";
    range.max = "5";
    range.step = "1";
    range.value = String(weights[cIdx]);
    range.className = "vw-slider-input";
    range.addEventListener("input", () => {
      weights[cIdx] = Number(range.value);
      valSpan.textContent = `×${weights[cIdx]}`;
      renderRankedOptions();
    });

    item.append(top, range);
    sliderGrid.appendChild(item);
  });

  slidersBox.appendChild(sliderGrid);
  renderRankedOptions();
  section.append(slidersBox, cardsWrap);
  return section;
}
