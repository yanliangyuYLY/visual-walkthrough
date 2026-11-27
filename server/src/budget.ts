// Author: a
import type {
  LeafUiBlock,
  NormalizedUiCard,
  NormalizedWalkthrough,
  UiBlock,
} from "./shared/types";

export const MAX_PAYLOAD_BYTES = 750 * 1024; // 留足余量，严格低于 Antigravity 1 MiB 轨迹上限

export function measureJsonBytes(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), "utf-8");
}

export function truncateMultilineText(
  text: string,
  maxLines = 40,
  maxChars = 4000,
  suffix = "// ...（内容过长已按轨迹体积限制截断，点击上方文件路径可在侧栏查看完整文件）",
): string {
  const lines = text.split("\n");
  if (lines.length > maxLines) {
    return `${lines.slice(0, maxLines).join("\n")}\n${suffix}`;
  }
  if (text.length > maxChars) {
    return `${text.slice(0, maxChars)}\n${suffix}`;
  }
  return text;
}

function cloneLeafBlock(block: LeafUiBlock): LeafUiBlock {
  if (block.type === "findings") {
    return { ...block, items: block.items.map((item) => ({ ...item })) };
  }
  if (block.type === "plan") {
    return { ...block, steps: block.steps.map((step) => ({ ...step })) };
  }
  if (block.type === "steps") {
    return { ...block, items: block.items.map((item) => ({ ...item })) };
  }
  if (block.type === "table") {
    return { ...block, rows: block.rows.map((row) => [...row]) };
  }
  return { ...block };
}

function cloneBlock(block: UiBlock): UiBlock {
  if (block.type === "tabs") {
    return {
      ...block,
      tabs: block.tabs.map((tab) => ({
        ...tab,
        blocks: tab.blocks.map(cloneLeafBlock),
      })),
    };
  }
  return cloneLeafBlock(block);
}

function shrinkLeafBlock(block: LeafUiBlock, aggressive: boolean): boolean {
  const maxLines = aggressive ? 16 : 40;
  const maxChars = aggressive ? 1200 : 4000;

  if (block.type === "code") {
    const next = truncateMultilineText(block.code, maxLines, maxChars);
    if (next !== block.code) {
      block.code = next;
      return true;
    }
    return false;
  }

  if (block.type === "diff") {
    const next = truncateMultilineText(
      block.patch,
      aggressive ? 24 : 60,
      aggressive ? 1600 : 5000,
      "...（Diff 过长已按轨迹体积限制截断）",
    );
    if (next !== block.patch) {
      block.patch = next;
      return true;
    }
    return false;
  }

  if (block.type === "findings") {
    let changed = false;
    for (const item of block.items) {
      if (item.fix) {
        const nextFix = truncateMultilineText(
          item.fix,
          aggressive ? 10 : 25,
          aggressive ? 800 : 2000,
          "// ...（修复代码已截断）",
        );
        if (nextFix !== item.fix) {
          item.fix = nextFix;
          changed = true;
        }
      }
      if (aggressive && item.detail && item.detail.length > 500) {
        item.detail = `${item.detail.slice(0, 500)}…`;
        changed = true;
      }
    }
    return changed;
  }

  if (block.type === "text" && block.content.length > maxChars) {
    block.content = `${block.content.slice(0, maxChars)}\n…（正文已按体积限制精简）`;
    return true;
  }

  if (block.type === "callout" && block.text.length > maxChars) {
    block.text = `${block.text.slice(0, maxChars)}\n…（提示内容已精简）`;
    return true;
  }

  if (aggressive && block.type === "table" && block.rows.length > 20) {
    block.rows = block.rows.slice(0, 20);
    return true;
  }

  return false;
}

function collectLeafBlocks(blocks: UiBlock[]): LeafUiBlock[] {
  const out: LeafUiBlock[] = [];
  for (const block of blocks) {
    if (block.type === "tabs") {
      for (const tab of block.tabs) {
        out.push(...tab.blocks);
      }
    } else {
      out.push(block);
    }
  }
  return out;
}

export function enforceWalkthroughBudget(
  payload: NormalizedWalkthrough,
  maxBytes = MAX_PAYLOAD_BYTES,
): NormalizedWalkthrough {
  if (measureJsonBytes(payload) <= maxBytes) {
    return payload;
  }

  const trimmed: NormalizedWalkthrough = {
    ...payload,
    codeBlocks: payload.codeBlocks.map((block) => ({ ...block })),
    notes: [...payload.notes],
    truncated: true,
  };

  for (let i = trimmed.codeBlocks.length - 1; i >= 0 && measureJsonBytes(trimmed) > maxBytes; i--) {
    trimmed.codeBlocks[i].code = truncateMultilineText(trimmed.codeBlocks[i].code);
  }

  if (measureJsonBytes(trimmed) > maxBytes) {
    for (let i = trimmed.codeBlocks.length - 1; i >= 0 && measureJsonBytes(trimmed) > maxBytes; i--) {
      trimmed.codeBlocks[i].code = truncateMultilineText(trimmed.codeBlocks[i].code, 12, 800);
    }
  }

  if (measureJsonBytes(trimmed) > maxBytes) {
    while (trimmed.codeBlocks.length > 1 && measureJsonBytes(trimmed) > maxBytes) {
      trimmed.codeBlocks.pop();
    }
    trimmed.notes.push("部分超长代码内容已自动精简，以符合 Antigravity 单次工具结果 1 MiB 体积上限。");
  }

  return trimmed;
}

export function enforceUiCardBudget(
  payload: NormalizedUiCard,
  maxBytes = MAX_PAYLOAD_BYTES,
): NormalizedUiCard {
  if (measureJsonBytes(payload) <= maxBytes) {
    return payload;
  }

  const trimmed: NormalizedUiCard = {
    ...payload,
    blocks: payload.blocks.map(cloneBlock),
    truncated: true,
  };

  const leaves = collectLeafBlocks(trimmed.blocks);

  // 第一轮：温和截断超长代码块、Diff、Findings.fix 与大文本（含 tabs 内嵌套块）
  for (let i = leaves.length - 1; i >= 0 && measureJsonBytes(trimmed) > maxBytes; i--) {
    shrinkLeafBlock(leaves[i], false);
  }

  // 第二轮：仍超限时采用更紧凑截断
  if (measureJsonBytes(trimmed) > maxBytes) {
    for (let i = leaves.length - 1; i >= 0 && measureJsonBytes(trimmed) > maxBytes; i--) {
      shrinkLeafBlock(leaves[i], true);
    }
  }

  // 兜底提示（仅当附加后仍不突破硬上限时插入）
  const noticeBlock: UiBlock = {
    type: "callout",
    tone: "info",
    title: "体积保护提示",
    text: "部分超长代码或 Diff 内容已按 Antigravity 单次工具结果体积上限自动精简。",
  };
  if (measureJsonBytes({ ...trimmed, blocks: [...trimmed.blocks, noticeBlock] }) <= maxBytes) {
    trimmed.blocks.push(noticeBlock);
  }

  return trimmed;
}
