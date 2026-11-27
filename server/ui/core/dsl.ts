// Author: a
import type {
  ButtonAction,
  CellValue,
  LeafUiBlock,
  StoredPayload,
  UiBlock,
} from "../../src/shared/types";
import { copyText } from "./bridge";

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
  if (action.type === "queue") return `Queue(${JSON.stringify(action.text)})`;
  if (action.type === "copy") return `Copy(${JSON.stringify(action.text)})`;
  return `OpenFile(${JSON.stringify(action.fileUri)})`;
}

function formatLeafBlock(block: LeafUiBlock, indent: string): string[] {
  const pad = `${indent}  `;
  const lines: string[] = [];

  if (block.type === "table") {
    lines.push(`${indent}Table(`);
    lines.push(`${pad}${JSON.stringify(block.columns)},`);
    lines.push(`${pad}[`);
    block.rows.forEach((row, rIdx) => {
      const rComma = rIdx < block.rows.length - 1 ? "," : "";
      lines.push(`${pad}  [${row.map(formatCellSpec).join(", ")}]${rComma}`);
    });
    lines.push(`${pad}]${block.commentable ? ", commentable: true" : ""}`);
    lines.push(`${indent})`);
  } else if (block.type === "callout") {
    lines.push(`${indent}Callout(`);
    lines.push(`${pad}${JSON.stringify(block.text)},`);
    lines.push(`${pad}tone: ${JSON.stringify(block.tone ?? "info")}${block.title ? "," : ""}`);
    if (block.title) {
      lines.push(`${pad}title: ${JSON.stringify(block.title)}`);
    }
    lines.push(`${indent})`);
  } else if (block.type === "actions") {
    lines.push(`${indent}Row([`);
    block.buttons.forEach((b, bIdx) => {
      const bComma = bIdx < block.buttons.length - 1 ? "," : "";
      lines.push(
        `${pad}Button(${JSON.stringify(b.label)}, ${formatActionSpec(b.action)}, variant: ${JSON.stringify(
          b.variant ?? "secondary",
        )})${bComma}`,
      );
    });
    lines.push(`${indent}])`);
  } else if (block.type === "mermaid") {
    const linked = block.nodeDetails ? Object.keys(block.nodeDetails).length : 0;
    lines.push(
      `${indent}Mermaid(${JSON.stringify(block.code)}${linked ? `, nodeDetails: ${linked}` : ""})`,
    );
  } else if (block.type === "steps") {
    lines.push(
      `${indent}Steps(${block.items.length} items${block.commentable ? ", commentable: true" : ""})`,
    );
  } else if (block.type === "code") {
    lines.push(`${indent}Code(${JSON.stringify(block.title)}, startLine: ${block.startLine ?? 1})`);
  } else if (block.type === "text") {
    lines.push(`${indent}Text(${JSON.stringify(block.content)})`);
  } else if (block.type === "metrics") {
    const items = block.items.map((m) => `Metric(${JSON.stringify(m.label)}, ${JSON.stringify(m.value)})`);
    lines.push(`${indent}Metrics([${items.join(", ")}])`);
  } else if (block.type === "diff") {
    const label = block.title ?? block.fileRef ?? "patch";
    const lineCount = block.patch.split("\n").length;
    lines.push(`${indent}Diff(${JSON.stringify(label)}, lines: ${lineCount})`);
  } else if (block.type === "findings") {
    lines.push(
      `${indent}Findings(${block.items.length} items${block.selectable ? ", selectable: true" : ""}${
        block.commentable ? ", commentable: true" : ""
      })`,
    );
  } else if (block.type === "plan") {
    lines.push(
      `${indent}Plan(${block.steps.length} steps${block.commentable ? ", commentable: true" : ""})`,
    );
  } else if (block.type === "decision") {
    const opts = block.options.map((o) => JSON.stringify(o.name)).join(", ");
    const crits = block.criteria.map((c) => JSON.stringify(c.name)).join(", ");
    lines.push(`${indent}Decision(options: [${opts}], criteria: [${crits}])`);
  }

  return lines;
}

function formatBlock(block: UiBlock, indent: string): string[] {
  if (block.type === "tabs") {
    const lines: string[] = [`${indent}Tabs([`];
    block.tabs.forEach((tab, tIdx) => {
      const tComma = tIdx < block.tabs.length - 1 ? "," : "";
      lines.push(`${indent}  Tab(${JSON.stringify(tab.label)}, [`);
      tab.blocks.forEach((leaf, bIdx) => {
        const rendered = formatLeafBlock(leaf, `${indent}    `);
        if (bIdx < tab.blocks.length - 1 && rendered.length > 0) {
          rendered[rendered.length - 1] += ",";
        }
        lines.push(...rendered);
      });
      lines.push(`${indent}  ])${tComma}`);
    });
    lines.push(`${indent}])`);
    return lines;
  }
  return formatLeafBlock(block, indent);
}

export function formatPayloadAsDsl(payload: StoredPayload): string {
  if (payload.kind !== "ui_card") {
    const lines: string[] = [`Walkthrough(${JSON.stringify(payload.title)}, [`];
    if (payload.mermaid) {
      const linked = payload.nodeDetails ? Object.keys(payload.nodeDetails).length : 0;
      lines.push(`  Mermaid(lines: ${payload.mermaid.split("\n").length}${linked ? `, nodeDetails: ${linked}` : ""}),`);
    }
    if (payload.steps.length > 0) {
      lines.push(`  Steps(${payload.steps.length} items),`);
    }
    if (payload.codeBlocks.length > 0) {
      lines.push(`  CodeBlocks(${payload.codeBlocks.length} blocks)`);
    }
    lines.push("])");
    return lines.join("\n");
  }

  const lines: string[] = [`Card(${JSON.stringify(payload.title)}, [`];
  payload.blocks.forEach((block, idx) => {
    const rendered = formatBlock(block, "  ");
    if (idx < payload.blocks.length - 1 && rendered.length > 0) {
      rendered[rendered.length - 1] += ",";
    }
    lines.push(...rendered);
  });
  lines.push("])");
  return lines.join("\n");
}

export function buildSpecSourceFooter(payload: StoredPayload): HTMLElement {
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
