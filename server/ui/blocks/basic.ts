// Author: a
import type {
  ActionsBlock,
  CalloutBlock,
  CellValue,
  CodeBlock,
  StepItem,
  TableBlock,
} from "../../src/shared/types";
import {
  canSendMessage,
  copyText,
  isValidFileUri,
  openFileInAuxPane,
  sendMessageToHost,
  showToast,
} from "../core/bridge";
import {
  appendInlineFormattedText,
  createCommentInlineControl,
  createFileRefElement,
} from "../core/format";
import type { CardStateStore } from "../state/store";

export function buildStepsList(
  steps: StepItem[],
  options: {
    store: CardStateStore;
    blockKey: string;
    commentable?: boolean;
  },
): HTMLElement {
  const list = document.createElement("ol");
  list.className = "vw-steps";
  const state = options.store.getState();

  steps.forEach((step, idx) => {
    const stepNum = step.number ?? idx + 1;
    const li = document.createElement("li");
    li.className = "vw-step";
    li.dataset.stepNumber = String(stepNum);

    const badge = document.createElement("span");
    badge.className = "vw-step-badge";
    badge.textContent = String(stepNum);

    const body = document.createElement("div");
    body.className = "vw-step-body";

    const titleRow = document.createElement("div");
    titleRow.className = "vw-step-title-row";

    const title = document.createElement("div");
    title.className = "vw-step-title";
    title.textContent = step.title;
    titleRow.appendChild(title);

    const desc = document.createElement("div");
    desc.className = "vw-step-desc";
    appendInlineFormattedText(desc, step.description);

    const fileRefEl = createFileRefElement(
      step.fileRef,
      step.fileUri,
      step.lineStart,
      step.lineEnd,
    );
    if (fileRefEl) {
      desc.appendChild(fileRefEl);
    }

    body.append(titleRow, desc);

    if (options.commentable) {
      const commentKey = `${options.blockKey}:step-${stepNum}`;
      const label = `步骤 ${stepNum} (${step.title})`;
      const { trigger, editor } = createCommentInlineControl({
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
      titleRow.appendChild(trigger);
      body.appendChild(editor);
    }

    li.append(badge, body);
    list.appendChild(li);
  });

  return list;
}

export function buildSingleCodeCard(block: CodeBlock, defaultOpenFallback = true): HTMLElement {
  const card = document.createElement("div");
  const isOpenDefault = block.defaultOpen ?? defaultOpenFallback;
  card.className = isOpenDefault ? "vw-code-card is-open" : "vw-code-card";

  const summaryBtn = document.createElement("button");
  summaryBtn.type = "button";
  summaryBtn.className = "vw-code-summary";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = block.title;

  const chevron = document.createElement("span");
  chevron.className = "vw-code-chevron";
  chevron.textContent = "⌄";

  summaryBtn.append(titleSpan, chevron);
  summaryBtn.addEventListener("click", () => {
    card.classList.toggle("is-open");
  });

  const body = document.createElement("div");
  body.className = "vw-code-body";

  const meta = document.createElement("div");
  meta.className = "vw-code-meta";

  const pathWrap = document.createElement("div");
  pathWrap.className = "vw-code-path";
  const pathLabel = block.fileRef
    ? `${block.fileRef}${block.startLine && !block.fileRef.includes(":") ? `:${block.startLine}` : ""}`
    : isValidFileUri(block.fileUri)
      ? block.fileUri.replace(/^file:\/\//, "")
      : block.language || "source";

  if (isValidFileUri(block.fileUri)) {
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "vw-file-link";
    openBtn.style.marginLeft = "0";
    openBtn.textContent = pathLabel;
    openBtn.title = "在侧栏打开完整文件";
    openBtn.addEventListener("click", () => {
      void openFileInAuxPane(block.fileUri!);
    });
    pathWrap.appendChild(openBtn);
  } else {
    pathWrap.textContent = pathLabel;
  }

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "vw-tool-btn";
  copyBtn.textContent = "复制";
  copyBtn.addEventListener("click", () => {
    void copyText(block.code, "源码");
  });

  meta.append(pathWrap, copyBtn);

  const scroll = document.createElement("div");
  scroll.className = "vw-code-scroll";

  const table = document.createElement("table");
  table.className = "vw-code-table";
  const tbody = document.createElement("tbody");

  const startLine = block.startLine ?? 1;
  const lines = block.code.split("\n");
  lines.forEach((lineText, idx) => {
    const tr = document.createElement("tr");

    const tdNum = document.createElement("td");
    tdNum.className = "vw-code-ln";
    tdNum.textContent = String(startLine + idx);

    const tdCode = document.createElement("td");
    tdCode.className = "vw-code-line";
    tdCode.textContent = lineText.length > 0 ? lineText : " ";

    tr.append(tdNum, tdCode);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  scroll.appendChild(table);
  body.append(meta, scroll);
  card.append(summaryBtn, body);
  return card;
}

export function buildCodeBlocks(blocks: CodeBlock[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "vw-code-section";
  blocks.forEach((block, index) => {
    section.appendChild(buildSingleCodeCard(block, index === 0));
  });
  return section;
}

function cellPlainText(cell: CellValue): string {
  if (typeof cell === "string") return cell;
  if ("badge" in cell) return cell.badge;
  if ("code" in cell) return cell.code;
  if ("fileRef" in cell) return cell.fileRef;
  return "";
}

function renderCellContent(cell: CellValue): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "vw-cell";

  if (typeof cell === "string") {
    appendInlineFormattedText(wrap, cell);
    return wrap;
  }

  if ("badge" in cell) {
    const tone = cell.tone ?? "neutral";
    const badge = document.createElement("span");
    badge.className = `vw-badge vw-badge-${tone}`;

    const dot = document.createElement("span");
    dot.className = "vw-badge-dot";

    const txt = document.createElement("span");
    txt.textContent = cell.badge;

    badge.append(dot, txt);
    wrap.appendChild(badge);
    return wrap;
  }

  if ("code" in cell) {
    const code = document.createElement("code");
    code.className = "vw-inline-code";
    code.textContent = cell.code;
    wrap.appendChild(code);
    return wrap;
  }

  if ("fileRef" in cell) {
    const link = createFileRefElement(cell.fileRef, cell.fileUri, undefined, undefined, true);
    if (link) {
      if (link.classList.contains("vw-file-link") || link.classList.contains("vw-file-static")) {
        link.style.marginLeft = "0";
      }
      wrap.appendChild(link);
    }
    return wrap;
  }

  return wrap;
}

function measureDisplayLen(text: string): number {
  let len = 0;
  for (const ch of text) {
    len += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return len;
}

function classifyTableColumns(columns: string[], rows: CellValue[][]): string[] {
  return columns.map((colHeader, colIdx) => {
    const colCells = rows.map((row) => row[colIdx]).filter((c) => c !== undefined && c !== "");
    if (colCells.length === 0) return "";

    if (colCells.every((c) => typeof c === "object" && "badge" in c)) return "vw-col-badge";
    if (colCells.every((c) => typeof c === "object" && "fileRef" in c)) return "vw-col-file";
    if (colCells.every((c) => typeof c === "object" && "code" in c)) return "vw-col-code";

    let maxLen = measureDisplayLen(colHeader);
    for (const c of colCells) {
      maxLen = Math.max(
        maxLen,
        measureDisplayLen(cellPlainText(c)) + (typeof c === "object" && "badge" in c ? 4 : 0),
      );
    }

    if (maxLen <= 14) return "vw-col-compact";
    if (maxLen >= 28) return "vw-col-wide";
    return "";
  });
}

export function buildTableBlock(
  block: TableBlock,
  options: {
    store: CardStateStore;
    blockKey: string;
    cardCommentable?: boolean;
  },
): HTMLElement {
  const commentable = block.commentable ?? options.cardCommentable ?? false;
  const state = options.store.getState();

  const wrap = document.createElement("div");
  wrap.className = "vw-table-wrap";

  const table = document.createElement("table");
  table.className = "vw-table";

  const colClasses = classifyTableColumns(block.columns, block.rows);

  const thead = document.createElement("thead");
  const headTr = document.createElement("tr");
  block.columns.forEach((col, i) => {
    const th = document.createElement("th");
    if (colClasses[i]) th.className = colClasses[i];
    th.textContent = col;
    headTr.appendChild(th);
  });
  if (commentable) {
    const thAct = document.createElement("th");
    thAct.className = "vw-col-compact";
    thAct.textContent = "批注";
    headTr.appendChild(thAct);
  }
  thead.appendChild(headTr);

  const tbody = document.createElement("tbody");
  block.rows.forEach((row, rIdx) => {
    const tr = document.createElement("tr");
    for (let i = 0; i < block.columns.length; i++) {
      const td = document.createElement("td");
      if (colClasses[i]) td.className = colClasses[i];
      const cell = row[i] ?? "";
      td.appendChild(renderCellContent(cell));
      tr.appendChild(td);
    }

    let editorRow: HTMLTableRowElement | null = null;
    if (commentable) {
      const commentKey = `${options.blockKey}:row-${rIdx}`;
      const rowLabel = cellPlainText(row[0] ?? "") || `第 ${rIdx + 1} 行`;
      const { trigger, editor } = createCommentInlineControl({
        commentKey,
        label: rowLabel,
        initialText: state.comments[commentKey]?.text ?? "",
        initiallyOpen: state.openCommentKeys.has(commentKey),
        onToggleOpen: (open) => {
          if (open) state.openCommentKeys.add(commentKey);
          else state.openCommentKeys.delete(commentKey);
          if (editorRow) editorRow.hidden = !open;
        },
        onSave: (text) => options.store.setComment(commentKey, rowLabel, text),
      });

      const tdAct = document.createElement("td");
      tdAct.className = "vw-col-compact";
      tdAct.appendChild(trigger);
      tr.appendChild(tdAct);

      editorRow = document.createElement("tr");
      editorRow.className = "vw-table-comment-row";
      editorRow.hidden = !state.openCommentKeys.has(commentKey);
      const tdEdit = document.createElement("td");
      tdEdit.colSpan = block.columns.length + 1;
      editor.hidden = false;
      tdEdit.appendChild(editor);
      editorRow.appendChild(tdEdit);
    }

    tbody.appendChild(tr);
    if (editorRow) tbody.appendChild(editorRow);
  });

  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

export function buildCalloutBlock(block: CalloutBlock): HTMLElement {
  const tone = block.tone ?? "info";
  const box = document.createElement("div");
  box.className = `vw-callout vw-callout-${tone}`;

  if (block.title) {
    const titleRow = document.createElement("div");
    titleRow.className = "vw-callout-title";

    const icon = document.createElement("span");
    icon.className = "vw-callout-icon";
    icon.textContent =
      tone === "good" ? "✓" : tone === "warn" ? "!" : tone === "bad" ? "✕" : "i";

    const titleText = document.createElement("span");
    titleText.textContent = block.title;

    titleRow.append(icon, titleText);
    box.appendChild(titleRow);
  }

  const body = document.createElement("div");
  body.className = "vw-callout-body";
  appendInlineFormattedText(body, block.text);
  box.appendChild(body);

  return box;
}

export function buildActionsRow(
  block: ActionsBlock,
  options: { store: CardStateStore; blockKey: string },
): HTMLElement | null {
  const sendEnabled = canSendMessage();
  const visibleButtons = block.buttons.filter(
    (b) => b.action.type !== "send" || sendEnabled,
  );

  if (visibleButtons.length === 0) {
    return null;
  }

  const row = document.createElement("div");
  row.className = "vw-actions";

  visibleButtons.forEach((btnSpec, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    const variant = btnSpec.variant ?? "secondary";
    btn.className = `vw-action-btn vw-action-${variant}`;

    const action = btnSpec.action;
    const queueKey = `${options.blockKey}:btn-${idx}`;

    const syncQueueLabel = () => {
      if (action.type !== "queue") return;
      const active = options.store.isQueued(queueKey);
      btn.classList.toggle("is-queued", active);
      btn.textContent = active ? `✓ ${btnSpec.label}` : btnSpec.label;
    };

    if (action.type === "queue") {
      syncQueueLabel();
      options.store.subscribe(syncQueueLabel);
    } else {
      btn.textContent = btnSpec.label;
    }

    btn.addEventListener("click", async () => {
      if (action.type === "copy") {
        await copyText(action.text, "内容");
        return;
      }
      if (action.type === "open_file") {
        await openFileInAuxPane(action.fileUri);
        return;
      }
      if (action.type === "queue") {
        const added = options.store.toggleQueueItem({
          key: queueKey,
          label: action.label ?? btnSpec.label,
          text: action.text,
        });
        showToast(added ? "已加入暂存队列" : "已移出暂存队列");
        return;
      }
      if (action.type === "send") {
        const prevText = btn.textContent ?? btnSpec.label;
        const composed = options.store.buildComposedReply(action.text);
        btn.disabled = true;
        btn.textContent = "发送中…";
        const ok = await sendMessageToHost(composed);
        if (ok) {
          await options.store.clearAllFeedback();
          showToast("已发送到对话");
          btn.textContent = `✓ ${prevText}`;
          window.setTimeout(() => {
            btn.disabled = false;
            btn.textContent = prevText;
          }, 1600);
        } else {
          btn.disabled = false;
          btn.textContent = prevText;
        }
      }
    });

    row.appendChild(btn);
  });

  return row;
}
