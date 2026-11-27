// Author: a
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { MINI_GALLERY } from "../src/gallery";
import {
  AppSaveDraftInputShape,
  BlockSchema,
  UiCardInputShape,
  WalkthroughInputShape,
} from "../src/schema";

const UiCardSchema = z.object(UiCardInputShape);
const WalkthroughSchema = z.object(WalkthroughInputShape);
const SaveDraftSchema = z.object(AppSaveDraftInputShape);

describe("schema validation and backward compatibility", () => {
  it("validates legacy v1.1.0 ui_card blocks seamlessly", () => {
    const legacyCard = {
      title: "旧版排查卡片",
      blocks: [
        {
          type: "table",
          columns: ["字段", "状态"],
          rows: [["phone", { badge: "异常", tone: "bad" }]],
        },
        { type: "callout", tone: "good", title: "结论", text: "验证通过" },
        {
          type: "actions",
          buttons: [
            { label: "应用修复", variant: "primary", action: { type: "send", text: "执行修复" } },
          ],
        },
      ],
    };

    const parsed = UiCardSchema.safeParse(legacyCard);
    assert.equal(parsed.success, true);
  });

  it("validates all 6 new v2.0.0 blocks and queue action", () => {
    const newCard = {
      title: "v2 研发综合卡片",
      commentable: true,
      allowCustomInput: true,
      blocks: [
        { type: "metrics", items: [{ label: "问题数", value: "2", tone: "warn" }] },
        {
          type: "tabs",
          defaultTab: "t1",
          tabs: [
            {
              id: "t1",
              label: "审查",
              blocks: [
                {
                  type: "findings",
                  items: [{ severity: "high", title: "空指针风险", fix: "-a\n+b", fixIsDiff: true }],
                },
                { type: "diff", patch: "@@ -1,1 +1,1 @@\n-old\n+new" },
              ],
            },
            {
              id: "t2",
              label: "计划与决策",
              blocks: [
                { type: "plan", steps: [{ title: "重构模块", risk: "medium", optional: true }] },
                {
                  type: "decision",
                  criteria: [{ name: "成本", weight: 3 }],
                  options: [
                    { name: "方案 A", scores: [5] },
                    { name: "方案 B", scores: [3] },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "actions",
          buttons: [{ label: "暂存建议", action: { type: "queue", text: "先补单测" } }],
        },
      ],
    };

    const parsed = UiCardSchema.safeParse(newCard);
    assert.equal(parsed.success, true);
  });

  it("rejects nested tabs inside tabs to keep JSON schema flat", () => {
    const nested = {
      type: "tabs",
      tabs: [
        {
          id: "outer",
          label: "Outer",
          blocks: [
            {
              type: "tabs",
              tabs: [{ id: "inner", label: "Inner", blocks: [{ type: "text", content: "hi" }] }],
            },
          ],
        },
      ],
    };
    assert.equal(BlockSchema.safeParse(nested).success, false);
  });

  it("validates walkthrough nodeDetails and all built-in Mini Gallery entries", () => {
    for (const entry of MINI_GALLERY) {
      if (entry.payload.kind === "walkthrough") {
        assert.equal(WalkthroughSchema.safeParse(entry.payload).success, true, entry.id);
      } else {
        assert.equal(UiCardSchema.safeParse(entry.payload).success, true, entry.id);
      }
    }
  });

  it("validates app_save_draft payload bounds", () => {
    const ok = SaveDraftSchema.safeParse({
      cardId: "card-1",
      queued: [{ key: "k1", label: "L", text: "T" }],
      comments: { c1: { label: "步骤1", text: "改名" } },
      customNote: "补充说明",
    });
    assert.equal(ok.success, true);
  });
});
