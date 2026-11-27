// Author: a
import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import mermaid from "mermaid";
import { z } from "zod/v4";

interface StepItem {
  number?: number;
  title: string;
  description: string;
  fileRef?: string;
  fileUri?: string;
  lineStart?: number;
  lineEnd?: number;
}

interface CodeBlock {
  title: string;
  fileRef?: string;
  fileUri?: string;
  language?: string;
  startLine?: number;
  code: string;
  defaultOpen?: boolean;
}

type CellValue =
  | string
  | { badge: string; tone?: "good" | "warn" | "bad" | "info" | "neutral" }
  | { code: string }
  | { fileRef: string; fileUri?: string };

type ButtonAction =
  | { type: "send"; text: string }
  | { type: "copy"; text: string }
  | { type: "open_file"; fileUri: string };

interface ActionButton {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  action: ButtonAction;
}

type UiBlock =
  | { type: "table"; columns: string[]; rows: CellValue[][] }
  | { type: "callout"; title?: string; text: string; tone?: "good" | "info" | "warn" | "bad" }
  | { type: "mermaid"; code: string }
  | { type: "steps"; items: StepItem[] }
  | ({ type: "code" } & CodeBlock)
  | { type: "text"; content: string }
  | { type: "actions"; buttons: ActionButton[] };

interface WalkthroughPayload {
  kind?: "walkthrough";
  title: string;
  subtitle?: string;
  mermaid?: string;
  steps?: StepItem[];
  codeBlocks?: CodeBlock[];
  notes?: string[];
}

interface UiCardPayload {
  kind: "ui_card";
  title: string;
  subtitle?: string;
  blocks: UiBlock[];
}

type AnyPayload = WalkthroughPayload | UiCardPayload;

const ToggleAuxPaneResultSchema = z
  .object({
    isError: z.boolean().optional(),
  })
  .passthrough();

const rootEl = document.getElementById("app") as HTMLElement;
const app = new App({ name: "Visual Walkthrough", version: "1.1.0" });

let currentPayload: AnyPayload | null = null;
let currentTheme: "light" | "dark" = "light";
let renderCounter = 0;

function showToast(message: string) {
  const existing = document.querySelector(".vw-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "vw-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`已复制${label}`);
  } catch {
    showToast("当前环境禁止剪贴板写入");
  }
}

function isValidFileUri(uri?: string): uri is string {
  return typeof uri === "string" && uri.startsWith("file://");
}

async function openFileInAuxPane(uri: string) {
  if (!isValidFileUri(uri)) {
    showToast("无效的文件路径（需要 file:// URI）");
    return;
  }
  try {
    const res = await app.request(
      {
        method: "com.google.antigravity/toggle-aux-pane",
        params: { tabType: "fileView", uri },
      } as unknown as Parameters<typeof app.request>[0],
      ToggleAuxPaneResultSchema,
    );
    if (res?.isError) {
      showToast("当前视图不支持侧栏打开文件");
    }
  } catch {
    showToast("当前宿主不支持侧栏文件跳转");
  }
}

function appendInlineFormattedText(container: HTMLElement, text: string) {
  const lines = text.split("\n");
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      container.appendChild(document.createElement("br"));
    }
    const segments = line.split(/(`[^`]+`)/g);
    for (const segment of segments) {
      if (segment.startsWith("`") && segment.endsWith("`") && segment.length >= 2) {
        const code = document.createElement("code");
        code.className = "vw-inline-code";
        code.textContent = segment.slice(1, -1);
        container.appendChild(code);
      } else if (segment.length > 0) {
        container.appendChild(document.createTextNode(segment));
      }
    }
  });
}

function normalizeMermaidSource(source: string): string {
  return source.replace(/\\n/g, "<br/>").trim();
}

function configureMermaid(theme: "light" | "dark") {
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

function createFileRefElement(
  fileRef?: string,
  fileUri?: string,
  lineStart?: number,
  lineEnd?: number,
): HTMLElement | null {
  const label = fileRef
    ? lineStart && !fileRef.includes(":")
      ? `${fileRef}:${lineStart}${lineEnd && lineEnd !== lineStart ? `-${lineEnd}` : ""}`
      : fileRef
    : isValidFileUri(fileUri)
      ? fileUri.replace(/^file:\/\//, "")
      : "";

  if (!label) return null;

  if (isValidFileUri(fileUri)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vw-file-link";
    btn.title = "在侧栏打开源文件";
    btn.textContent = `(${label})`;
    btn.addEventListener("click", () => {
      void openFileInAuxPane(fileUri);
    });
    return btn;
  }

  const span = document.createElement("span");
  span.className = "vw-file-static";
  span.textContent = `(${label})`;
  return span;
}

function buildMermaidPanel(rawMermaid: string): HTMLElement {
  const box = document.createElement("section");
  box.className = "vw-mermaid-box";

  const toolbar = document.createElement("div");
  toolbar.className = "vw-mermaid-toolbar";

  const label = document.createElement("span");
  label.className = "vw-mermaid-label";
  label.textContent = "FLOWCHART";

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
  toolbar.append(label, actions);
  box.appendChild(toolbar);

  const viewport = document.createElement("div");
  viewport.className = "vw-mermaid-viewport";

  const stage = document.createElement("div");
  stage.className = "vw-mermaid-stage";
  viewport.appendChild(stage);
  box.appendChild(viewport);

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

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  viewport.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originX = panX;
    originY = panY;
    viewport.classList.add("is-dragging");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    panX = originX + (e.clientX - startX);
    panY = originY + (e.clientY - startY);
    applyTransform();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-dragging");
  });

  const normalized = normalizeMermaidSource(rawMermaid);
  const diagramId = `vw-mermaid-${++renderCounter}`;
  configureMermaid(currentTheme);

  mermaid
    .render(diagramId, normalized)
    .then(({ svg }) => {
      stage.innerHTML = svg;
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

function buildStepsList(steps: StepItem[]): HTMLElement {
  const list = document.createElement("ol");
  list.className = "vw-steps";

  steps.forEach((step, idx) => {
    const li = document.createElement("li");
    li.className = "vw-step";

    const badge = document.createElement("span");
    badge.className = "vw-step-badge";
    badge.textContent = String(step.number ?? idx + 1);

    const body = document.createElement("div");
    body.className = "vw-step-body";

    const title = document.createElement("div");
    title.className = "vw-step-title";
    title.textContent = step.title;

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

    body.append(title, desc);
    li.append(badge, body);
    list.appendChild(li);
  });

  return list;
}

function buildSingleCodeCard(block: CodeBlock, defaultOpenFallback = true): HTMLElement {
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
    ? `${block.fileRef}${block.startLine ? `:${block.startLine}` : ""}`
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

function buildCodeBlocks(blocks: CodeBlock[]): HTMLElement {
  const section = document.createElement("section");
  section.className = "vw-code-section";
  blocks.forEach((block, index) => {
    section.appendChild(buildSingleCodeCard(block, index === 0));
  });
  return section;
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
    const link = createFileRefElement(cell.fileRef, cell.fileUri);
    if (link) {
      if (link.classList.contains("vw-file-link")) {
        link.style.marginLeft = "0";
      }
      wrap.appendChild(link);
    }
    return wrap;
  }

  return wrap;
}

function buildTableBlock(block: Extract<UiBlock, { type: "table" }>): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "vw-table-wrap";

  const table = document.createElement("table");
  table.className = "vw-table";

  const thead = document.createElement("thead");
  const headTr = document.createElement("tr");
  for (const col of block.columns) {
    const th = document.createElement("th");
    th.textContent = col;
    headTr.appendChild(th);
  }
  thead.appendChild(headTr);

  const tbody = document.createElement("tbody");
  for (const row of block.rows) {
    const tr = document.createElement("tr");
    for (let i = 0; i < block.columns.length; i++) {
      const td = document.createElement("td");
      const cell = row[i] ?? "";
      td.appendChild(renderCellContent(cell));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
  wrap.appendChild(table);
  return wrap;
}

function buildCalloutBlock(block: Extract<UiBlock, { type: "callout" }>): HTMLElement {
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

function buildActionsRow(block: Extract<UiBlock, { type: "actions" }>): HTMLElement | null {
  const canSendMessage = Boolean(app.getHostCapabilities()?.message);
  const visibleButtons = block.buttons.filter(
    (b) => b.action.type !== "send" || canSendMessage,
  );

  if (visibleButtons.length === 0) {
    return null;
  }

  const row = document.createElement("div");
  row.className = "vw-actions";

  for (const btnSpec of visibleButtons) {
    const btn = document.createElement("button");
    btn.type = "button";
    const variant = btnSpec.variant ?? "secondary";
    btn.className = `vw-action-btn vw-action-${variant}`;
    btn.textContent = btnSpec.label;

    btn.addEventListener("click", async () => {
      const action = btnSpec.action;
      if (action.type === "copy") {
        await copyText(action.text, "内容");
        return;
      }
      if (action.type === "open_file") {
        await openFileInAuxPane(action.fileUri);
        return;
      }
      if (action.type === "send") {
        const prevText = btn.textContent ?? btnSpec.label;
        btn.disabled = true;
        btn.textContent = "发送中…";
        try {
          const res = await app.sendMessage({
            role: "user",
            content: [{ type: "text", text: action.text }],
          });
          if (res?.isError) {
            showToast("宿主拒绝发送该消息");
            btn.disabled = false;
            btn.textContent = prevText;
          } else {
            showToast("已发送到对话");
            btn.textContent = `✓ ${prevText}`;
            window.setTimeout(() => {
              btn.disabled = false;
              btn.textContent = prevText;
            }, 1800);
          }
        } catch {
          showToast("消息发送失败");
          btn.disabled = false;
          btn.textContent = prevText;
        }
      }
    });

    row.appendChild(btn);
  }

  return row;
}

function formatCellSpec(cell: CellValue): string {
  if (typeof cell === "string") return JSON.stringify(cell);
  if ("badge" in cell) {
    return `Badge(${JSON.stringify(cell.badge)}, tone: ${JSON.stringify(cell.tone ?? "neutral")})`;
  }
  if ("code" in cell) {
    return `CodeInline(${JSON.stringify(cell.code)})`;
  }
  if ("fileRef" in cell) {
    return `File(${JSON.stringify(cell.fileRef)})`;
  }
  return '""';
}

function formatActionSpec(action: ButtonAction): string {
  if (action.type === "send") return `Send(${JSON.stringify(action.text)})`;
  if (action.type === "copy") return `Copy(${JSON.stringify(action.text)})`;
  return `OpenFile(${JSON.stringify(action.fileUri)})`;
}

function formatPayloadAsDsl(payload: AnyPayload): string {
  if (payload.kind !== "ui_card") {
    return JSON.stringify(payload, null, 2);
  }

  const lines: string[] = [`Card(${JSON.stringify(payload.title)}, [`];
  payload.blocks.forEach((block, idx) => {
    const comma = idx < payload.blocks.length - 1 ? "," : "";
    if (block.type === "table") {
      lines.push("  Table(");
      lines.push(`    ${JSON.stringify(block.columns)},`);
      lines.push("    [");
      block.rows.forEach((row, rIdx) => {
        const rComma = rIdx < block.rows.length - 1 ? "," : "";
        lines.push(`      [${row.map(formatCellSpec).join(", ")}]${rComma}`);
      });
      lines.push("    ]");
      lines.push(`  )${comma}`);
    } else if (block.type === "callout") {
      lines.push("  Callout(");
      lines.push(`    ${JSON.stringify(block.text)},`);
      lines.push(`    tone: ${JSON.stringify(block.tone ?? "info")},`);
      if (block.title) {
        lines.push(`    title: ${JSON.stringify(block.title)}`);
      }
      lines.push(`  )${comma}`);
    } else if (block.type === "actions") {
      lines.push("  Row([");
      block.buttons.forEach((b, bIdx) => {
        const bComma = bIdx < block.buttons.length - 1 ? "," : "";
        lines.push(
          `    Button(${JSON.stringify(b.label)}, ${formatActionSpec(b.action)}, variant: ${JSON.stringify(
            b.variant ?? "secondary",
          )})${bComma}`,
        );
      });
      lines.push(`  ])${comma}`);
    } else if (block.type === "mermaid") {
      lines.push(`  Mermaid(${JSON.stringify(block.code)})${comma}`);
    } else if (block.type === "steps") {
      lines.push(`  Steps(${block.items.length} items)${comma}`);
    } else if (block.type === "code") {
      lines.push(`  Code(${JSON.stringify(block.title)}, startLine: ${block.startLine ?? 1})${comma}`);
    } else if (block.type === "text") {
      lines.push(`  Text(${JSON.stringify(block.content)})${comma}`);
    }
  });
  lines.push("])");
  return lines.join("\n");
}

function buildSpecSourceFooter(payload: AnyPayload): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "vw-source-wrap";

  const bar = document.createElement("div");
  bar.className = "vw-source-bar";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "vw-source-toggle";
  toggleBtn.textContent = "<> Source";

  bar.appendChild(toggleBtn);
  wrap.appendChild(bar);

  const panel = document.createElement("div");
  panel.className = "vw-source-panel";
  panel.hidden = true;

  const panelHead = document.createElement("div");
  panelHead.className = "vw-source-head";

  const headLabel = document.createElement("span");
  headLabel.textContent = "Spec source";

  const specText = formatPayloadAsDsl(payload);
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "vw-tool-btn";
  copyBtn.textContent = "复制";
  copyBtn.addEventListener("click", () => {
    void copyText(specText, "Spec source");
  });

  panelHead.append(headLabel, copyBtn);

  const pre = document.createElement("pre");
  pre.className = "vw-source-pre";
  pre.textContent = specText;

  panel.append(panelHead, pre);
  wrap.appendChild(panel);

  toggleBtn.addEventListener("click", () => {
    const nextOpen = panel.hidden;
    panel.hidden = !nextOpen;
    toggleBtn.textContent = nextOpen ? "<> Hide source" : "<> Source";
  });

  return wrap;
}

function createCardShell(titleText: string, subtitle?: string): {
  card: HTMLElement;
} {
  const card = document.createElement("article");
  card.className = "vw-card";

  const header = document.createElement("header");
  header.className = "vw-header";

  const headerLeft = document.createElement("div");
  const h1 = document.createElement("h1");
  h1.className = "vw-title";
  h1.textContent = titleText;
  headerLeft.appendChild(h1);

  if (subtitle) {
    const sub = document.createElement("p");
    sub.className = "vw-subtitle";
    sub.textContent = subtitle;
    headerLeft.appendChild(sub);
  }

  header.appendChild(headerLeft);
  card.appendChild(header);

  return { card };
}

function renderWalkthrough(payload: WalkthroughPayload) {
  currentPayload = payload;
  rootEl.replaceChildren();

  const { card } = createCardShell(payload.title, payload.subtitle);

  if (payload.mermaid) {
    card.appendChild(buildMermaidPanel(payload.mermaid));
  }

  if (payload.steps && payload.steps.length > 0) {
    card.appendChild(buildStepsList(payload.steps));
  }

  if (payload.codeBlocks && payload.codeBlocks.length > 0) {
    card.appendChild(buildCodeBlocks(payload.codeBlocks));
  }

  if (payload.notes && payload.notes.length > 0) {
    const notesDiv = document.createElement("div");
    notesDiv.className = "vw-notes";
    for (const note of payload.notes) {
      const p = document.createElement("div");
      appendInlineFormattedText(p, note);
      notesDiv.appendChild(p);
    }
    card.appendChild(notesDiv);
  }

  rootEl.appendChild(card);
}

function renderUiCard(payload: UiCardPayload) {
  currentPayload = payload;
  rootEl.replaceChildren();

  const { card } = createCardShell(payload.title, payload.subtitle);

  for (const block of payload.blocks) {
    if (block.type === "table") {
      card.appendChild(buildTableBlock(block));
    } else if (block.type === "callout") {
      card.appendChild(buildCalloutBlock(block));
    } else if (block.type === "mermaid") {
      card.appendChild(buildMermaidPanel(block.code));
    } else if (block.type === "steps") {
      card.appendChild(buildStepsList(block.items));
    } else if (block.type === "code") {
      card.appendChild(buildSingleCodeCard(block, block.defaultOpen ?? true));
    } else if (block.type === "text") {
      const p = document.createElement("div");
      p.className = "vw-step-desc";
      appendInlineFormattedText(p, block.content);
      card.appendChild(p);
    } else if (block.type === "actions") {
      const row = buildActionsRow(block);
      if (row) card.appendChild(row);
    }
  }

  rootEl.appendChild(card);
  rootEl.appendChild(buildSpecSourceFooter(payload));
}

function renderPayload(payload: AnyPayload) {
  if (payload.kind === "ui_card" || ("blocks" in payload && Array.isArray(payload.blocks))) {
    renderUiCard(payload as UiCardPayload);
  } else {
    renderWalkthrough(payload as WalkthroughPayload);
  }
}

function renderMessageState(message: string) {
  rootEl.replaceChildren();
  const box = document.createElement("div");
  box.className = "vw-empty";
  box.textContent = message;
  rootEl.appendChild(box);
}

function syncHostTheme(ctx?: McpUiHostContext) {
  if (!ctx) return;
  let themeChanged = false;
  if (ctx.theme === "light" || ctx.theme === "dark") {
    themeChanged = currentTheme !== ctx.theme;
    currentTheme = ctx.theme;
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (themeChanged && currentPayload) {
    renderPayload(currentPayload);
  }
}

// 必须在 connect() 前注册所有回调
app.ontoolinput = ({ arguments: args }) => {
  const title =
    args && typeof args === "object" && "title" in args && typeof args.title === "string"
      ? args.title
      : "";
  renderMessageState(title ? `正在生成「${title}」…` : "正在加载可视化卡片…");
};

app.ontoolresult = (result) => {
  const data = result.structuredContent as AnyPayload | undefined;
  if (data && typeof data.title === "string") {
    renderPayload(data);
    return;
  }
  const fallbackText = result.content?.find((item) => item.type === "text");
  renderMessageState(
    fallbackText && "text" in fallbackText ? fallbackText.text : "未收到可渲染的结构化数据",
  );
};

app.ontoolcancelled = () => {
  renderMessageState("卡片生成已取消。");
};

app.onhostcontextchanged = (ctx) => {
  syncHostTheme(ctx);
};

async function bootstrap() {
  try {
    await app.connect();
    syncHostTheme(app.getHostContext());
    if (currentPayload) {
      renderPayload(currentPayload);
    }
  } catch (err) {
    renderMessageState(
      `连接宿主失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

void bootstrap();
