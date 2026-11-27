// Author: a
// 纯逻辑：批注与暂存队列文案聚合（前后端及单元测试共享）

export interface QueuedFeedbackItem {
  key: string;
  label: string;
  text: string;
}

export function formatCommentEntry(label: string, comment: string): string | null {
  const trimmed = comment.trim();
  if (!trimmed) return null;
  const cleanLabel = label.trim();
  return cleanLabel ? `针对「${cleanLabel}」：${trimmed}` : trimmed;
}

export function composeReply(
  queued: readonly string[],
  finalText?: string | null,
): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const raw of [...queued, finalText ?? ""]) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parts.push(trimmed);
  }

  return parts.join("\n\n");
}

export function collectDraftEntries(params: {
  queued: readonly QueuedFeedbackItem[];
  comments: Readonly<Record<string, { label: string; text: string }>>;
  customNote: string;
}): Array<{ id: string; source: "queue" | "comment" | "custom"; label: string; text: string }> {
  const entries: Array<{
    id: string;
    source: "queue" | "comment" | "custom";
    label: string;
    text: string;
  }> = [];

  for (const item of params.queued) {
    const trimmed = item.text.trim();
    if (!trimmed) continue;
    entries.push({
      id: `queue:${item.key}`,
      source: "queue",
      label: item.label || trimmed,
      text: trimmed,
    });
  }

  for (const [key, comment] of Object.entries(params.comments)) {
    const formatted = formatCommentEntry(comment.label, comment.text);
    if (!formatted) continue;
    entries.push({
      id: `comment:${key}`,
      source: "comment",
      label: `批注 · ${comment.label}`,
      text: formatted,
    });
  }

  const note = params.customNote.trim();
  if (note) {
    entries.push({
      id: "custom:note",
      source: "custom",
      label: "补充说明",
      text: `补充说明：${note}`,
    });
  }

  return entries;
}
