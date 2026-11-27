// Author: a
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enforceUiCardBudget,
  enforceWalkthroughBudget,
  measureJsonBytes,
} from "../src/budget";
import type { NormalizedUiCard, NormalizedWalkthrough } from "../src/shared/types";

describe("recursive payload budget enforcement", () => {
  it("keeps compact cards untouched", () => {
    const card: NormalizedUiCard = {
      kind: "ui_card",
      cardId: "c1",
      createdAt: 1,
      title: "小卡片",
      blocks: [{ type: "text", content: "hello" }],
    };
    const out = enforceUiCardBudget(card, 10_000);
    assert.equal(out.truncated, undefined);
    assert.equal(out.blocks.length, 1);
  });

  it("recursively trims oversized diff, code, and findings.fix inside tabs", () => {
    const hugeLines = Array.from({ length: 300 }, (_, i) => `+ const line_${i} = "${"x".repeat(40)}";`).join("\n");
    const card: NormalizedUiCard = {
      kind: "ui_card",
      cardId: "c2",
      createdAt: 1,
      title: "超大 Tabs 卡片",
      blocks: [
        {
          type: "tabs",
          tabs: [
            {
              id: "diff-tab",
              label: "Diff",
              blocks: [{ type: "diff", patch: hugeLines }],
            },
            {
              id: "find-tab",
              label: "Findings",
              blocks: [
                {
                  type: "findings",
                  items: [{ severity: "high", title: "大修复", fix: hugeLines }],
                },
              ],
            },
          ],
        },
      ],
    };

    const budget = 8 * 1024;
    assert.ok(measureJsonBytes(card) > budget);

    const out = enforceUiCardBudget(card, budget);
    assert.equal(out.truncated, true);
    assert.ok(
      measureJsonBytes(out) <= budget,
      `trimmed size ${measureJsonBytes(out)} should be <= ${budget}`,
    );
  });

  it("trims oversized walkthrough codeBlocks under tight budget", () => {
    const hugeCode = Array.from({ length: 200 }, (_, i) => `const x${i} = "${"a".repeat(50)}";`).join("\n");
    const wt: NormalizedWalkthrough = {
      kind: "walkthrough",
      cardId: "w1",
      createdAt: 1,
      title: "大源码逻辑卡",
      steps: [{ number: 1, title: "Step 1", description: "desc" }],
      codeBlocks: [
        { title: "A", startLine: 1, defaultOpen: true, code: hugeCode },
        { title: "B", startLine: 1, defaultOpen: false, code: hugeCode },
      ],
      notes: [],
    };

    const budget = 4 * 1024;
    const out = enforceWalkthroughBudget(wt, budget);
    assert.equal(out.truncated, true);
    assert.ok(measureJsonBytes(out) <= budget);
  });
});
