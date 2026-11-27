// Author: a
import { isValidFileUri, openFileInAuxPane } from "./bridge";

export function appendInlineFormattedText(container: HTMLElement, text: string): void {
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

export function createFileRefElement(
  fileRef?: string,
  fileUri?: string,
  lineStart?: number,
  lineEnd?: number,
  bare = false,
): HTMLElement | null {
  const label = fileRef
    ? lineStart && !fileRef.includes(":")
      ? `${fileRef}:${lineStart}${lineEnd && lineEnd !== lineStart ? `-${lineEnd}` : ""}`
      : fileRef
    : isValidFileUri(fileUri)
      ? fileUri.replace(/^file:\/\//, "")
      : "";

  if (!label) return null;

  const displayText = bare ? label : `(${label})`;

  if (isValidFileUri(fileUri)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "vw-file-link";
    btn.title = "在侧栏打开源文件";
    btn.textContent = displayText;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void openFileInAuxPane(fileUri);
    });
    return btn;
  }

  const span = document.createElement("span");
  span.className = "vw-file-static";
  span.textContent = displayText;
  return span;
}

export interface CommentControlOptions {
  commentKey: string;
  label: string;
  initialText: string;
  initiallyOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  onSave: (text: string) => void;
}

/**
 * 轻量级行内批注触发按钮 + 可折叠编辑条，供 steps / table / findings / plan 统一复用。
 */
export function createCommentInlineControl(options: CommentControlOptions): {
  trigger: HTMLButtonElement;
  editor: HTMLElement;
} {
  let isOpen = options.initiallyOpen;
  let savedText = options.initialText;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = savedText ? "vw-comment-trigger has-comment" : "vw-comment-trigger";
  trigger.textContent = savedText ? "已批注" : "批注";
  trigger.title = savedText ? `编辑批注：${savedText}` : `对「${options.label}」添加批注`;

  const editor = document.createElement("div");
  editor.className = "vw-comment-editor";
  editor.hidden = !isOpen;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "vw-comment-input";
  input.placeholder = `输入对「${options.label}」的修改意见或追问（回车暂存）…`;
  input.value = savedText;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "vw-tool-btn is-active";
  saveBtn.textContent = "暂存";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "vw-tool-btn";
  clearBtn.textContent = "清除";
  clearBtn.hidden = !savedText;

  const commit = (closeAfter = false) => {
    const val = input.value.trim();
    savedText = val;
    trigger.textContent = val ? "已批注" : "批注";
    trigger.classList.toggle("has-comment", Boolean(val));
    trigger.title = val ? `编辑批注：${val}` : `对「${options.label}」添加批注`;
    clearBtn.hidden = !val;
    options.onSave(val);
    if (closeAfter) {
      isOpen = false;
      editor.hidden = true;
      options.onToggleOpen(false);
    }
  };

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    editor.hidden = !isOpen;
    options.onToggleOpen(isOpen);
    if (isOpen) {
      input.focus();
    }
  });

  saveBtn.addEventListener("click", () => commit(true));
  clearBtn.addEventListener("click", () => {
    input.value = "";
    commit(true);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(true);
    } else if (e.key === "Escape") {
      isOpen = false;
      editor.hidden = true;
      options.onToggleOpen(false);
    }
  });

  editor.append(input, saveBtn, clearBtn);
  return { trigger, editor };
}
