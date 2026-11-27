// Author: a
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { PluginStorage, parseDataDirArg } from "../src/storage";
import type { NormalizedUiCard } from "../src/shared/types";

function makeCard(id: string, title: string): NormalizedUiCard {
  return {
    kind: "ui_card",
    cardId: id,
    createdAt: Date.now(),
    title,
    blocks: [{ type: "text", content: title }],
  };
}

describe("PluginStorage persistence and fallback", () => {
  it("parses --data_dir in both = and space forms", () => {
    assert.equal(parseDataDirArg(["--data_dir=/tmp/abc"]), "/tmp/abc");
    assert.equal(parseDataDirArg(["--data_dir", "/tmp/def"]), "/tmp/def");
  });

  it("falls back cleanly to memory-only when dataDir is absent", async () => {
    const store = new PluginStorage();
    assert.equal(store.persistent, false);
    await store.saveCard(makeCard("c1", "内存卡片"));
    const loaded = await store.getCardById("c1");
    assert.equal(loaded?.title, "内存卡片");
  });

  it("persists history (capped at 30) and drafts across restarts", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vw-storage-test-"));
    try {
      const store1 = new PluginStorage(tmpDir);
      assert.equal(store1.persistent, true);

      for (let i = 1; i <= 35; i++) {
        await store1.saveCard(makeCard(`card-${i}`, `卡片 ${i}`));
      }

      await store1.saveDraft({
        cardId: "card-35",
        updatedAt: Date.now(),
        queued: [{ key: "q1", label: "暂存项", text: "补充测试" }],
        comments: { c1: { label: "步骤1", text: "调整命名" } },
        customNote: "保持向后兼容",
      });

      // 模拟重启后从磁盘重新初始化
      const store2 = new PluginStorage(tmpDir);
      const list = await store2.listHistory();
      assert.equal(list.length, 30);
      assert.equal(list[0].cardId, "card-35");

      const latest = await store2.getLatestCard();
      assert.equal(latest?.cardId, "card-35");
      assert.equal(latest?.draft?.customNote, "保持向后兼容");
      assert.equal(latest?.draft?.queued.length, 1);

      // 清空草稿后应移除记录
      await store2.saveDraft({
        cardId: "card-35",
        updatedAt: Date.now(),
        queued: [],
        comments: {},
        customNote: "",
      });
      const reloaded = await store2.getCardById("card-35");
      assert.equal(reloaded?.draft, undefined);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
