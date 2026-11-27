// Author: a
import type {
  LeafUiBlock,
  MermaidBlock,
  MetricsBlock,
  TabsBlock,
  UiBlock,
} from "../../src/shared/types";
import { appendInlineFormattedText } from "../core/format";
import type { CardStateStore } from "../state/store";
import {
  buildActionsRow,
  buildCalloutBlock,
  buildSingleCodeCard,
  buildStepsList,
  buildTableBlock,
} from "./basic";
import { buildDecisionBlock } from "./decision";
import { buildDiffBlock } from "./diff";
import { buildFindingsBlock } from "./findings";
import { buildPlanBlock } from "./plan";

export interface BlockRenderContext {
  store: CardStateStore;
  cardCommentable?: boolean;
  renderMermaid: (block: MermaidBlock, blockKey: string) => HTMLElement;
}

export function buildMetricsBlock(block: MetricsBlock): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "vw-metrics-grid";

  for (const item of block.items) {
    const cell = document.createElement("div");
    const tone = item.tone ?? "neutral";
    cell.className = `vw-metric-card vw-metric-${tone}`;

    const label = document.createElement("div");
    label.className = "vw-metric-label";
    label.textContent = item.label;

    const valRow = document.createElement("div");
    valRow.className = "vw-metric-val-row";

    const val = document.createElement("span");
    val.className = "vw-metric-value";
    val.textContent = item.value;
    valRow.appendChild(val);

    if (item.delta) {
      const delta = document.createElement("span");
      delta.className = "vw-metric-delta";
      delta.textContent = item.delta;
      valRow.appendChild(delta);
    }

    cell.append(label, valRow);
    grid.appendChild(cell);
  }

  return grid;
}

export function renderLeafBlock(
  block: LeafUiBlock,
  blockKey: string,
  ctx: BlockRenderContext,
): HTMLElement | null {
  switch (block.type) {
    case "table":
      return buildTableBlock(block, {
        store: ctx.store,
        blockKey,
        cardCommentable: ctx.cardCommentable,
      });
    case "callout":
      return buildCalloutBlock(block);
    case "mermaid":
      return ctx.renderMermaid(block, blockKey);
    case "steps":
      return buildStepsList(block.items, {
        store: ctx.store,
        blockKey,
        commentable: block.commentable ?? ctx.cardCommentable,
      });
    case "code":
      return buildSingleCodeCard(block, block.defaultOpen ?? true);
    case "text": {
      const p = document.createElement("div");
      p.className = "vw-step-desc";
      appendInlineFormattedText(p, block.content);
      return p;
    }
    case "actions":
      return buildActionsRow(block, { store: ctx.store, blockKey });
    case "metrics":
      return buildMetricsBlock(block);
    case "diff":
      return buildDiffBlock(block);
    case "findings":
      return buildFindingsBlock(block, {
        store: ctx.store,
        blockKey,
        cardCommentable: ctx.cardCommentable,
      });
    case "plan":
      return buildPlanBlock(block, {
        store: ctx.store,
        blockKey,
        cardCommentable: ctx.cardCommentable,
      });
    case "decision":
      return buildDecisionBlock(block, { store: ctx.store, blockKey });
    default:
      return null;
  }
}

export function buildTabsBlock(
  block: TabsBlock,
  blockKey: string,
  ctx: BlockRenderContext,
): HTMLElement {
  const state = ctx.store.getState();
  const validIds = new Set(block.tabs.map((t) => t.id));
  let activeId = state.activeTabs[blockKey];
  if (!activeId || !validIds.has(activeId)) {
    activeId = block.defaultTab && validIds.has(block.defaultTab)
      ? block.defaultTab
      : block.tabs[0]?.id ?? "";
    state.activeTabs[blockKey] = activeId;
  }

  const wrap = document.createElement("section");
  wrap.className = "vw-tabs";

  const tabBar = document.createElement("div");
  tabBar.className = "vw-tabs-bar";
  tabBar.setAttribute("role", "tablist");

  const panelWrap = document.createElement("div");
  panelWrap.className = "vw-tabs-panel";

  const renderTabs = () => {
    tabBar.replaceChildren();
    panelWrap.replaceChildren();

    for (const tab of block.tabs) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      const isActive = tab.id === activeId;
      btn.setAttribute("aria-selected", String(isActive));
      btn.className = isActive ? "vw-tab-btn is-active" : "vw-tab-btn";

      const labelSpan = document.createElement("span");
      labelSpan.textContent = tab.label;
      btn.appendChild(labelSpan);

      if (tab.badge) {
        const b = document.createElement("span");
        b.className = "vw-tab-badge";
        b.textContent = tab.badge;
        btn.appendChild(b);
      }

      btn.addEventListener("click", () => {
        if (activeId === tab.id) return;
        activeId = tab.id;
        state.activeTabs[blockKey] = tab.id;
        renderTabs();
      });
      tabBar.appendChild(btn);

      if (isActive) {
        tab.blocks.forEach((leaf, leafIdx) => {
          const el = renderLeafBlock(leaf, `${blockKey}:${tab.id}:${leafIdx}`, ctx);
          if (el) panelWrap.appendChild(el);
        });
      }
    }
  };

  renderTabs();
  wrap.append(tabBar, panelWrap);
  return wrap;
}

export function renderUiBlock(
  block: UiBlock,
  blockKey: string,
  ctx: BlockRenderContext,
): HTMLElement | null {
  if (block.type === "tabs") {
    return buildTabsBlock(block, blockKey, ctx);
  }
  return renderLeafBlock(block, blockKey, ctx);
}
