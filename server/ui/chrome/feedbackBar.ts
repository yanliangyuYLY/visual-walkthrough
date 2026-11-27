// Author: a
import {
  canSendMessage,
  canUpdateModelContext,
  copyText,
  sendMessageToHost,
  showToast,
} from "../core/bridge";
import type { CardStateStore } from "../state/store";

export function buildCustomNoteBox(store: CardStateStore): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "vw-custom-note";

  const label = document.createElement("label");
  label.className = "vw-custom-note-label";
  label.textContent = "自由补充说明（将与已勾选/批注项合并发回对话）";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "vw-comment-input";
  input.placeholder = "例如：保留旧接口兼容，优先补齐单测…";
  input.value = store.getState().customNote;

  input.addEventListener("input", () => {
    store.setCustomNote(input.value);
  });

  // 仅同步外部清空（如点击“清空”或发送完毕）
  store.subscribe(() => {
    const val = store.getState().customNote;
    if (document.activeElement !== input && input.value !== val) {
      input.value = val;
    }
  });

  wrap.append(label, input);
  return wrap;
}

export function buildFeedbackTray(
  store: CardStateStore,
  onSyncExternalControls?: () => void,
): HTMLElement {
  const tray = document.createElement("section");
  tray.className = "vw-feedback-tray";
  let expanded = false;

  const renderTray = () => {
    const entries = store.getFeedbackEntries();
    tray.replaceChildren();
    if (entries.length === 0) {
      tray.hidden = true;
      return;
    }
    tray.hidden = false;

    const header = document.createElement("div");
    header.className = "vw-feedback-head";

    const left = document.createElement("div");
    left.className = "vw-feedback-meta";

    const countBtn = document.createElement("button");
    countBtn.type = "button";
    countBtn.className = "vw-feedback-toggle";
    countBtn.textContent = `${expanded ? "▾" : "▸"} 已暂存 ${entries.length} 条反馈`;
    countBtn.addEventListener("click", () => {
      expanded = !expanded;
      renderTray();
    });
    left.appendChild(countBtn);

    if (canUpdateModelContext() && store.getState().contextSynced) {
      const pillHint = document.createElement("span");
      pillHint.className = "vw-pill-tag";
      pillHint.textContent = "已挂入输入框 Pill";
      pillHint.title = "你在聊天输入框直接发消息时也会自动附带这些反馈";
      left.appendChild(pillHint);
    }

    const actions = document.createElement("div");
    actions.className = "vw-feedback-actions";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "vw-tool-btn";
    clearBtn.textContent = "清空";
    clearBtn.addEventListener("click", async () => {
      await store.clearAllFeedback();
      onSyncExternalControls?.();
      showToast("已清空暂存反馈");
    });

    if (canSendMessage()) {
      const sendBtn = document.createElement("button");
      sendBtn.type = "button";
      sendBtn.className = "vw-action-btn vw-action-primary vw-btn-sm";
      sendBtn.textContent = "发送汇总";
      sendBtn.addEventListener("click", async () => {
        const composed = store.buildComposedReply();
        if (!composed) return;
        sendBtn.disabled = true;
        sendBtn.textContent = "发送中…";
        const ok = await sendMessageToHost(composed);
        if (ok) {
          await store.clearAllFeedback();
          onSyncExternalControls?.();
          showToast("已发送汇总反馈到对话");
        } else {
          sendBtn.disabled = false;
          sendBtn.textContent = "发送汇总";
        }
      });
      actions.append(clearBtn, sendBtn);
    } else {
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "vw-action-btn vw-action-secondary vw-btn-sm";
      copyBtn.textContent = "复制汇总";
      copyBtn.addEventListener("click", () => {
        const composed = store.buildComposedReply();
        if (composed) void copyText(composed, "汇总反馈");
      });
      actions.append(clearBtn, copyBtn);
    }

    header.append(left, actions);
    tray.appendChild(header);

    if (expanded) {
      const list = document.createElement("ul");
      list.className = "vw-feedback-list";
      for (const entry of entries) {
        const li = document.createElement("li");
        li.className = "vw-feedback-item";

        const txt = document.createElement("span");
        txt.className = "vw-feedback-text";
        txt.textContent = entry.text;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "vw-tool-btn";
        removeBtn.textContent = "×";
        removeBtn.title = "移除此项";
        removeBtn.addEventListener("click", () => {
          store.removeFeedbackEntry(entry.id);
          onSyncExternalControls?.();
        });

        li.append(txt, removeBtn);
        list.appendChild(li);
      }
      tray.appendChild(list);
    }
  };

  store.subscribe(renderTray);
  renderTray();
  return tray;
}
