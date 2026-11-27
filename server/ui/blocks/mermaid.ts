// Author: a
import mermaid from "mermaid";
import type { MermaidNodeDetail } from "../../src/shared/types";
import { appendInlineFormattedText, createFileRefElement } from "../core/format";
import type { CardStateStore } from "../state/store";

let renderCounter = 0;

function normalizeMermaidSource(source: string): string {
  return source.replace(/\\n/g, "<br/>").trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function configureMermaid(theme: "light" | "dark"): void {
  const isDark = theme === "dark";
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    flowchart: {
      curve: "basis",
      htmlLabels: true,
      padding: 12,
    },
    themeVariables: isDark
      ? {
          fontFamily:
            'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
          fontSize: "12px",
          primaryColor: "#332922",
          primaryTextColor: "#f3ebe2",
          primaryBorderColor: "#d97736",
          lineColor: "#c58a5f",
          secondaryColor: "#29221d",
          tertiaryColor: "#29221d",
          background: "transparent",
        }
      : {
          fontFamily:
            'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
          fontSize: "12px",
          primaryColor: "#f7ece0",
          primaryTextColor: "#362b22",
          primaryBorderColor: "#c86a2b",
          lineColor: "#a87049",
          secondaryColor: "#f5efe6",
          tertiaryColor: "#f5efe6",
          background: "transparent",
        },
  });
}

function matchNodeId(el: Element, keys: string[]): string | null {
  const dataId = el.getAttribute("data-id");
  if (dataId && keys.includes(dataId)) return dataId;
  const rawId = el.getAttribute("id") ?? "";
  for (const key of keys) {
    const pattern = new RegExp(`(?:^|-)${escapeRegExp(key)}(?:-\\d+)?$`);
    if (pattern.test(rawId)) return key;
  }
  return null;
}

export function buildMermaidPanel(options: {
  rawMermaid: string;
  nodeDetails?: Record<string, MermaidNodeDetail>;
  theme: "light" | "dark";
  store: CardStateStore;
  blockKey: string;
  onFocusStep?: (stepNumber: number) => void;
}): HTMLElement {
  const { rawMermaid, nodeDetails, theme, store, blockKey, onFocusStep } = options;
  const state = store.getState();
  const detailKeys = nodeDetails ? Object.keys(nodeDetails) : [];

  const box = document.createElement("section");
  box.className = "vw-mermaid-box";

  const toolbar = document.createElement("div");
  toolbar.className = "vw-mermaid-toolbar";

  const labelWrap = document.createElement("div");
  labelWrap.className = "vw-mermaid-label-wrap";

  const label = document.createElement("span");
  label.className = "vw-mermaid-label";
  label.textContent = "FLOWCHART";
  labelWrap.appendChild(label);

  if (detailKeys.length > 0) {
    const hint = document.createElement("span");
    hint.className = "vw-mermaid-hint";
    hint.textContent = "点击节点可查看详情与联动步骤";
    labelWrap.appendChild(hint);
  }

  const actions = document.createElement("div");
  actions.className = "vw-toolbar-actions";

  let scale = 1;
  let panX = 0;
  let panY = 0;
  let showSource = false;
  let isExpanded = false;

  const zoomOutBtn = document.createElement("button");
  zoomOutBtn.type = "button";
  zoomOutBtn.className = "vw-tool-btn";
  zoomOutBtn.textContent = "-";
  zoomOutBtn.title = "缩小";

  const zoomResetBtn = document.createElement("button");
  zoomResetBtn.type = "button";
  zoomResetBtn.className = "vw-tool-btn";
  zoomResetBtn.textContent = "100%";
  zoomResetBtn.title = "重置缩放与位置";

  const zoomInBtn = document.createElement("button");
  zoomInBtn.type = "button";
  zoomInBtn.className = "vw-tool-btn";
  zoomInBtn.textContent = "+";
  zoomInBtn.title = "放大";

  const sourceBtn = document.createElement("button");
  sourceBtn.type = "button";
  sourceBtn.className = "vw-tool-btn";
  sourceBtn.textContent = "Mermaid";
  sourceBtn.title = "查看/隐藏 Mermaid 源码";

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "vw-tool-btn";
  expandBtn.textContent = "↗";
  expandBtn.title = "展开/收起画布高度";

  actions.append(zoomOutBtn, zoomResetBtn, zoomInBtn, sourceBtn, expandBtn);
  toolbar.append(labelWrap, actions);
  box.appendChild(toolbar);

  const viewport = document.createElement("div");
  viewport.className = "vw-mermaid-viewport";

  const stage = document.createElement("div");
  stage.className = "vw-mermaid-stage";
  viewport.appendChild(stage);
  box.appendChild(viewport);

  // 节点点击联动详情条
  const detailBar = document.createElement("div");
  detailBar.className = "vw-node-detail";
  detailBar.hidden = true;
  box.appendChild(detailBar);

  const sourceWrap = document.createElement("div");
  sourceWrap.className = "vw-mermaid-source";
  sourceWrap.hidden = true;
  const sourcePre = document.createElement("pre");
  sourcePre.textContent = rawMermaid;
  sourceWrap.appendChild(sourcePre);
  box.appendChild(sourceWrap);

  const applyTransform = () => {
    stage.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    zoomResetBtn.textContent = `${Math.round(scale * 100)}%`;
  };

  zoomOutBtn.addEventListener("click", () => {
    scale = Math.max(0.5, Number((scale - 0.15).toFixed(2)));
    applyTransform();
  });

  zoomInBtn.addEventListener("click", () => {
    scale = Math.min(2.4, Number((scale + 0.15).toFixed(2)));
    applyTransform();
  });

  zoomResetBtn.addEventListener("click", () => {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform();
  });

  sourceBtn.addEventListener("click", () => {
    showSource = !showSource;
    sourceWrap.hidden = !showSource;
    sourceBtn.classList.toggle("is-active", showSource);
  });

  expandBtn.addEventListener("click", () => {
    isExpanded = !isExpanded;
    viewport.classList.toggle("is-expanded", isExpanded);
    expandBtn.classList.toggle("is-active", isExpanded);
  });

  // 临时绑定 window 事件并在 mouseup 释放，避免重渲染时全局事件泄漏
  let didDrag = false;
  viewport.addEventListener("mousedown", (e) => {
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = panX;
    const originY = panY;
    didDrag = false;
    viewport.classList.add("is-dragging");

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        didDrag = true;
      }
      panX = originX + dx;
      panY = originY + dy;
      applyTransform();
    };

    const onUp = () => {
      viewport.classList.remove("is-dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  const renderNodeDetail = (nodeId: string | null, shouldFocusStep: boolean) => {
    state.selectedMermaidNode[blockKey] = nodeId;
    stage.querySelectorAll(".vw-mermaid-node-selected").forEach((el) => {
      el.classList.remove("vw-mermaid-node-selected");
    });

    if (!nodeId || !nodeDetails?.[nodeId]) {
      detailBar.hidden = true;
      detailBar.replaceChildren();
      return;
    }

    const detail = nodeDetails[nodeId];
    stage.querySelectorAll("g.node").forEach((el) => {
      if (matchNodeId(el, detailKeys) === nodeId) {
        el.classList.add("vw-mermaid-node-selected");
      }
    });

    detailBar.replaceChildren();
    detailBar.hidden = false;

    const head = document.createElement("div");
    head.className = "vw-node-detail-head";

    const titleWrap = document.createElement("div");
    titleWrap.className = "vw-node-detail-title-wrap";

    const idTag = document.createElement("code");
    idTag.className = "vw-inline-code";
    idTag.textContent = nodeId;
    titleWrap.appendChild(idTag);

    if (detail.title) {
      const titleSpan = document.createElement("span");
      titleSpan.className = "vw-node-detail-title";
      titleSpan.textContent = detail.title;
      titleWrap.appendChild(titleSpan);
    }

    const fileEl = createFileRefElement(detail.fileRef, detail.fileUri, detail.lineStart);
    if (fileEl) titleWrap.appendChild(fileEl);

    const rightBtns = document.createElement("div");
    rightBtns.className = "vw-node-detail-actions";

    if (detail.stepNumber && onFocusStep) {
      const jumpBtn = document.createElement("button");
      jumpBtn.type = "button";
      jumpBtn.className = "vw-tool-btn is-active";
      jumpBtn.textContent = `定位 Step ${detail.stepNumber}`;
      jumpBtn.addEventListener("click", () => onFocusStep(detail.stepNumber!));
      rightBtns.appendChild(jumpBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "vw-tool-btn";
    closeBtn.textContent = "×";
    closeBtn.title = "关闭节点详情";
    closeBtn.addEventListener("click", () => renderNodeDetail(null, false));
    rightBtns.appendChild(closeBtn);

    head.append(titleWrap, rightBtns);

    const summary = document.createElement("div");
    summary.className = "vw-node-detail-body";
    appendInlineFormattedText(summary, detail.summary);

    detailBar.append(head, summary);

    if (shouldFocusStep && detail.stepNumber && onFocusStep) {
      onFocusStep(detail.stepNumber);
    }
  };

  const normalized = normalizeMermaidSource(rawMermaid);
  const diagramId = `vw-mermaid-${++renderCounter}`;
  configureMermaid(theme);

  mermaid
    .render(diagramId, normalized)
    .then(({ svg }) => {
      stage.innerHTML = svg;

      if (detailKeys.length > 0) {
        const nodes = stage.querySelectorAll("g.node");
        nodes.forEach((nodeEl) => {
          const matched = matchNodeId(nodeEl, detailKeys);
          if (!matched) return;
          nodeEl.classList.add("vw-mermaid-node-interactive");
          nodeEl.setAttribute("role", "button");
          nodeEl.setAttribute("tabindex", "0");

          const select = () => {
            if (didDrag) return;
            const current = state.selectedMermaidNode[blockKey];
            renderNodeDetail(current === matched ? null : matched, current !== matched);
          };

          nodeEl.addEventListener("click", (e) => {
            e.stopPropagation();
            select();
          });
          nodeEl.addEventListener("keydown", (e) => {
            const ke = e as KeyboardEvent;
            if (ke.key === "Enter" || ke.key === " ") {
              ke.preventDefault();
              select();
            }
          });
        });

        // 主题重渲染时恢复已选节点详情（不再次滚动）
        const prevSelected = state.selectedMermaidNode[blockKey];
        if (prevSelected && nodeDetails?.[prevSelected]) {
          renderNodeDetail(prevSelected, false);
        }
      }
    })
    .catch((err) => {
      const errBox = document.createElement("div");
      errBox.className = "vw-error-box";
      errBox.textContent = `Mermaid 渲染失败：${err instanceof Error ? err.message : String(err)}`;
      box.appendChild(errBox);
      sourceWrap.hidden = false;
      sourceBtn.classList.add("is-active");
    });

  return box;
}
