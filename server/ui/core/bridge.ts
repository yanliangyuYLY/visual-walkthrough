// Author: a
import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import { z } from "zod/v4";

const ToggleAuxPaneResultSchema = z
  .object({
    isError: z.boolean().optional(),
  })
  .passthrough();

export const app = new App({ name: "Visual Walkthrough", version: "2.0.0" });

let toastTimer: number | undefined;
let draftQueue: Promise<void> = Promise.resolve();

export function showToast(message: string): void {
  const existing = document.querySelector(".vw-toast");
  if (existing) existing.remove();
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
  }

  const toast = document.createElement("div");
  toast.className = "vw-toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  toastTimer = window.setTimeout(() => {
    toast.remove();
    toastTimer = undefined;
  }, 2200);
}

export async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`已复制${label}`);
  } catch {
    showToast("当前环境禁止剪贴板写入");
  }
}

export function isValidFileUri(uri?: string): uri is string {
  return typeof uri === "string" && uri.startsWith("file://");
}

export function canSendMessage(): boolean {
  return Boolean(app.getHostCapabilities()?.message);
}

export function canUpdateModelContext(): boolean {
  return Boolean(app.getHostCapabilities()?.updateModelContext);
}

export function canCallServerTools(): boolean {
  return Boolean(app.getHostCapabilities()?.serverTools);
}

export async function openFileInAuxPane(uri: string): Promise<void> {
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

export async function sendMessageToHost(text: string): Promise<boolean> {
  if (!canSendMessage()) {
    showToast("当前视图不支持直接发送对话消息");
    return false;
  }
  try {
    const res = await app.sendMessage({
      role: "user",
      content: [{ type: "text", text }],
    });
    if (res?.isError) {
      showToast("宿主拒绝发送该消息");
      return false;
    }
    return true;
  } catch {
    showToast("消息发送失败");
    return false;
  }
}

/**
 * 严格遵循官方规范：仅在响应用户显式操作时调用；空文本传入空 content 数组以清空 Pill。
 */
export async function syncModelContextToHost(text: string): Promise<boolean> {
  if (!canUpdateModelContext()) return false;
  const trimmed = text.trim();
  try {
    await app.updateModelContext({
      content: trimmed ? [{ type: "text", text: trimmed }] : [],
    });
    return true;
  } catch {
    return false;
  }
}

export async function callAppServerTool<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T | null> {
  if (!canCallServerTools()) return null;
  try {
    const res = await app.callServerTool({
      name,
      arguments: args,
    });
    if (res?.isError) return null;
    return (res?.structuredContent as T | undefined) ?? null;
  } catch {
    return null;
  }
}

/**
 * 串行持久化草稿：确保永远只占 1 个在途 serverTool 槽位，绝不触发官方 4 并发上限。
 */
export function enqueueDraftPersist(task: () => Promise<void>): void {
  if (!canCallServerTools()) return;
  draftQueue = draftQueue
    .then(task)
    .catch(() => {
      // 忽略单次草稿保存失败（如视图即将销毁时的请求中止）
    });
}

export function applyThemeFromHostContext(
  ctx: McpUiHostContext | undefined,
  prevTheme: "light" | "dark",
): { theme: "light" | "dark"; changed: boolean } {
  if (!ctx) return { theme: prevTheme, changed: false };
  let theme = prevTheme;
  let changed = false;
  if (ctx.theme === "light" || ctx.theme === "dark") {
    changed = prevTheme !== ctx.theme;
    theme = ctx.theme;
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  return { theme, changed };
}
