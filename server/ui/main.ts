// Author: a
import type {
  NormalizedUiCard,
  NormalizedWalkthrough,
  StoredPayload,
} from "../src/shared/types";
import { buildCodeBlocks, buildStepsList } from "./blocks/basic";
import { renderUiBlock } from "./blocks/layout";
import { buildMermaidPanel } from "./blocks/mermaid";
import { buildCustomNoteBox, buildFeedbackTray } from "./chrome/feedbackBar";
import { buildWorkbenchBar } from "./chrome/workbench";
import { app, applyThemeFromHostContext } from "./core/bridge";
import { buildSpecSourceFooter } from "./core/dsl";
import { appendInlineFormattedText } from "./core/format";
import { CardStateStore } from "./state/store";

const rootEl = document.getElementById("app") as HTMLElement;
const store = new CardStateStore();

let currentPayload: StoredPayload | null = null;
let currentTheme: "light" | "dark" = "light";

function focusStepInCard(cardEl: HTMLElement, stepNumber: number): void {
  const target = cardEl.querySelector<HTMLElement>(`[data-step-number="${stepNumber}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "nearest" });
  target.classList.remove("is-highlighted");
  // 强制重排以重新触发脉冲高亮动画
  void target.offsetWidth;
  target.classList.add("is-highlighted");
  window.setTimeout(() => {
    target.classList.remove("is-highlighted");
  }, 1800);
}

function createCardShell(titleText: string, subtitle?: string): HTMLElement {
  const card = document.createElement("article");
  card.className = "vw-card";

  const header = document.createElement("header");
  header.className = "vw-header";

  const headerLeft = document.createElement("div");
  const h1 = document.createElement("h1");
  h1.className = "vw-title";
  h1.textContent = titleText;
  headerLeft.appendChild(h1);

  if (subtitle) {
    const sub = document.createElement("p");
    sub.className = "vw-subtitle";
    sub.textContent = subtitle;
    headerLeft.appendChild(sub);
  }

  header.appendChild(headerLeft);
  card.appendChild(header);
  return card;
}

function renderWalkthrough(payload: NormalizedWalkthrough): void {
  const card = createCardShell(payload.title, payload.subtitle);

  if (payload.mermaid) {
    card.appendChild(
      buildMermaidPanel({
        rawMermaid: payload.mermaid,
        nodeDetails: payload.nodeDetails,
        theme: currentTheme,
        store,
        blockKey: "wt-mermaid",
        onFocusStep: (stepNum) => focusStepInCard(card, stepNum),
      }),
    );
  }

  if (payload.steps.length > 0) {
    card.appendChild(
      buildStepsList(payload.steps, {
        store,
        blockKey: "wt-steps",
        commentable: payload.commentable,
      }),
    );
  }

  if (payload.codeBlocks.length > 0) {
    card.appendChild(buildCodeBlocks(payload.codeBlocks));
  }

  if (payload.notes.length > 0) {
    const notesDiv = document.createElement("div");
    notesDiv.className = "vw-notes";
    for (const note of payload.notes) {
      const p = document.createElement("div");
      appendInlineFormattedText(p, note);
      notesDiv.appendChild(p);
    }
    card.appendChild(notesDiv);
  }

  if (payload.allowCustomInput) {
    card.appendChild(buildCustomNoteBox(store));
  }

  card.appendChild(buildFeedbackTray(store));
  rootEl.appendChild(card);
  rootEl.appendChild(buildSpecSourceFooter(payload));
}

function renderUiCard(payload: NormalizedUiCard): void {
  const card = createCardShell(payload.title, payload.subtitle);

  const ctx = {
    store,
    cardCommentable: payload.commentable,
    renderMermaid: (block: Parameters<typeof buildMermaidPanel>[0] extends never ? never : { code: string; nodeDetails?: NormalizedWalkthrough["nodeDetails"] }, blockKey: string) =>
      buildMermaidPanel({
        rawMermaid: block.code,
        nodeDetails: block.nodeDetails,
        theme: currentTheme,
        store,
        blockKey,
        onFocusStep: (stepNum) => focusStepInCard(card, stepNum),
      }),
  };

  payload.blocks.forEach((block, idx) => {
    const el = renderUiBlock(block, `b-${idx}`, ctx);
    if (el) card.appendChild(el);
  });

  if (payload.allowCustomInput) {
    card.appendChild(buildCustomNoteBox(store));
  }

  card.appendChild(buildFeedbackTray(store));
  rootEl.appendChild(card);
  rootEl.appendChild(buildSpecSourceFooter(payload));
}

function renderPayload(payload: StoredPayload): void {
  currentPayload = payload;
  store.activateCard(payload);
  rootEl.replaceChildren();

  const workbench = buildWorkbenchBar({
    currentPayload: payload,
    onSelectCard: (nextPayload) => renderPayload(nextPayload),
  });
  if (workbench) {
    rootEl.appendChild(workbench);
  }

  if (payload.kind === "ui_card" || ("blocks" in payload && Array.isArray(payload.blocks))) {
    renderUiCard(payload as NormalizedUiCard);
  } else {
    renderWalkthrough(payload as NormalizedWalkthrough);
  }
}

function renderMessageState(message: string): void {
  rootEl.replaceChildren();
  const box = document.createElement("div");
  box.className = "vw-empty";
  box.textContent = message;
  rootEl.appendChild(box);
}

// 必须在 connect() 前注册全部生命周期回调（Antigravity MCP App 规范）
app.ontoolinput = ({ arguments: args }) => {
  const title =
    args && typeof args === "object" && "title" in args && typeof args.title === "string"
      ? args.title
      : "";
  renderMessageState(title ? `正在生成「${title}」…` : "正在加载可视化卡片…");
};

app.ontoolresult = (result) => {
  const data = result.structuredContent as StoredPayload | undefined;
  if (data && typeof data.title === "string") {
    if (!data.cardId) {
      data.cardId = `legacy-${Date.now()}`;
    }
    renderPayload(data);
    return;
  }
  const fallbackText = result.content?.find((item) => item.type === "text");
  renderMessageState(
    fallbackText && "text" in fallbackText ? fallbackText.text : "未收到可渲染的结构化数据",
  );
};

app.ontoolcancelled = () => {
  renderMessageState("卡片生成已取消。");
};

app.onhostcontextchanged = (ctx) => {
  const { theme, changed } = applyThemeFromHostContext(ctx, currentTheme);
  currentTheme = theme;
  if (changed && currentPayload) {
    // 主题切换重渲染时，store 中保存的批注/暂存/Tab/权重/节点状态全部无损保留
    renderPayload(currentPayload);
  }
};

async function bootstrap(): Promise<void> {
  try {
    await app.connect();
    const { theme } = applyThemeFromHostContext(app.getHostContext(), currentTheme);
    currentTheme = theme;
    if (currentPayload) {
      renderPayload(currentPayload);
    }
  } catch (err) {
    renderMessageState(
      `连接宿主失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

void bootstrap();
