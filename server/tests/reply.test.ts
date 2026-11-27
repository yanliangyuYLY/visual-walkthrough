// Author: a
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectDraftEntries,
  composeReply,
  formatCommentEntry,
} from "../src/shared/reply";

describe("reply feedback aggregation", () => {
  it("formats comment entries cleanly and drops blanks", () => {
    assert.equal(formatCommentEntry("步骤 2", "  改成异步队列  "), "针对「步骤 2」：改成异步队列");
    assert.equal(formatCommentEntry("", "仅补充内容"), "仅补充内容");
    assert.equal(formatCommentEntry("步骤 2", "   "), null);
  });

  it("composes queued items and final action without duplicates", () => {
    const out = composeReply(
      ["  第一条  ", "", "第二条", "第一条"],
      "最终确认执行",
    );
    assert.equal(out, "第一条\n\n第二条\n\n最终确认执行");
  });

  it("collects queue, comments and custom note in stable order", () => {
    const entries = collectDraftEntries({
      queued: [{ key: "q1", label: "补压测", text: "补充压测数据" }],
      comments: {
        "s1": { label: "步骤 1", text: "加超时保护" },
        "s2": { label: "步骤 2", text: "   " },
      },
      customNote: "兼容旧接口",
    });

    assert.equal(entries.length, 3);
    assert.equal(entries[0].text, "补充压测数据");
    assert.equal(entries[1].text, "针对「步骤 1」：加超时保护");
    assert.equal(entries[2].text, "补充说明：兼容旧接口");
  });
});
