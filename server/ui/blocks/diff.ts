// Author: a
import type { DiffBlock } from "../../src/shared/types";
import { copyText, isValidFileUri, openFileInAuxPane } from "../core/bridge";

interface ParsedDiffRow {
  kind: "meta" | "hunk" | "add" | "del" | "ctx";
  oldLine: string;
  newLine: string;
  text: string;
}

function parseUnifiedDiff(patch: string): {
  rows: ParsedDiffRow[];
  additions: number;
  deletions: number;
} {
  const lines = patch.replace(/\r\n/g, "\n").split("\n");
  const rows: ParsedDiffRow[] = [];
  let oldNum: number | null = null;
  let newNum: number | null = null;
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    const hunkMatch = /^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/.exec(line);
    if (hunkMatch) {
      oldNum = Number(hunkMatch[1]);
      newNum = Number(hunkMatch[2]);
      rows.push({ kind: "hunk", oldLine: "…", newLine: "…", text: line });
      continue;
    }

    if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("diff --git ")) {
      rows.push({ kind: "meta", oldLine: "", newLine: "", text: line });
      continue;
    }

    if (line.startsWith("+")) {
      additions += 1;
      rows.push({
        kind: "add",
        oldLine: "",
        newLine: newNum !== null ? String(newNum++) : "+",
        text: line,
      });
      continue;
    }

    if (line.startsWith("-")) {
      deletions += 1;
      rows.push({
        kind: "del",
        oldLine: oldNum !== null ? String(oldNum++) : "-",
        newLine: "",
        text: line,
      });
      continue;
    }

    rows.push({
      kind: "ctx",
      oldLine: oldNum !== null ? String(oldNum++) : "",
      newLine: newNum !== null ? String(newNum++) : "",
      text: line.length > 0 ? line : " ",
    });
  }

  return { rows, additions, deletions };
}

export function buildDiffTableElement(patch: string): {
  el: HTMLElement;
  additions: number;
  deletions: number;
} {
  const { rows, additions, deletions } = parseUnifiedDiff(patch);
  const scroll = document.createElement("div");
  scroll.className = "vw-code-scroll";

  const table = document.createElement("table");
  table.className = "vw-code-table vw-diff-table";
  const tbody = document.createElement("tbody");

  for (const row of rows) {
    const tr = document.createElement("tr");
    tr.className = `vw-diff-row vw-diff-${row.kind}`;

    const tdOld = document.createElement("td");
    tdOld.className = "vw-code-ln vw-diff-ln";
    tdOld.textContent = row.oldLine;

    const tdNew = document.createElement("td");
    tdNew.className = "vw-code-ln vw-diff-ln";
    tdNew.textContent = row.newLine;

    const tdText = document.createElement("td");
    tdText.className = "vw-code-line";
    tdText.textContent = row.text;

    tr.append(tdOld, tdNew, tdText);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  scroll.appendChild(table);
  return { el: scroll, additions, deletions };
}

export function buildDiffBlock(block: DiffBlock): HTMLElement {
  const { el: diffScroll, additions, deletions } = buildDiffTableElement(block.patch);

  const card = document.createElement("div");
  const isOpenDefault = block.defaultOpen ?? true;
  card.className = isOpenDefault ? "vw-code-card is-open" : "vw-code-card";

  const summaryBtn = document.createElement("button");
  summaryBtn.type = "button";
  summaryBtn.className = "vw-code-summary";

  const left = document.createElement("span");
  left.className = "vw-diff-summary-left";

  const titleSpan = document.createElement("span");
  titleSpan.textContent = block.title ?? block.fileRef ?? "代码变更 Diff";
  left.appendChild(titleSpan);

  if (additions > 0 || deletions > 0) {
    const stat = document.createElement("span");
    stat.className = "vw-diff-stats";
    if (additions > 0) {
      const addSpan = document.createElement("span");
      addSpan.className = "vw-diff-stat-add";
      addSpan.textContent = `+${additions}`;
      stat.appendChild(addSpan);
    }
    if (deletions > 0) {
      const delSpan = document.createElement("span");
      delSpan.className = "vw-diff-stat-del";
      delSpan.textContent = `-${deletions}`;
      stat.appendChild(delSpan);
    }
    left.appendChild(stat);
  }

  const chevron = document.createElement("span");
  chevron.className = "vw-code-chevron";
  chevron.textContent = "⌄";

  summaryBtn.append(left, chevron);
  summaryBtn.addEventListener("click", () => {
    card.classList.toggle("is-open");
  });

  const body = document.createElement("div");
  body.className = "vw-code-body";

  const meta = document.createElement("div");
  meta.className = "vw-code-meta";

  const pathWrap = document.createElement("div");
  pathWrap.className = "vw-code-path";
  const pathLabel =
    block.fileRef ||
    (isValidFileUri(block.fileUri) ? block.fileUri.replace(/^file:\/\//, "") : "unified diff");

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
  copyBtn.textContent = "复制 Diff";
  copyBtn.addEventListener("click", () => {
    void copyText(block.patch, "Diff 补丁");
  });

  meta.append(pathWrap, copyBtn);
  body.append(meta, diffScroll);
  card.append(summaryBtn, body);
  return card;
}
