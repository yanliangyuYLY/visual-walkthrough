// Author: a
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import {
  AppGetCardInputShape,
  AppSaveDraftInputShape,
  OptionalWalkthroughInputShape,
  UiCardInputShape,
  WalkthroughInputShape,
} from "./schema";
import { enforceUiCardBudget, enforceWalkthroughBudget } from "./budget";
import { DEFAULT_DEMO_PAYLOAD, MINI_GALLERY, findGalleryPayload } from "./gallery";
import { PluginStorage, parseDataDirArg } from "./storage";
import type {
  CodeBlock,
  LeafUiBlock,
  MermaidNodeDetail,
  NormalizedUiCard,
  NormalizedWalkthrough,
  StepItem,
  StoredPayload,
  UiBlock,
} from "./shared/types";

const APP_URI = "ui://visual-walkthrough/app.html";
const PLUGIN_VERSION = "2.0.0";

const storage = new PluginStorage(parseDataDirArg(process.argv.slice(2)));

function createCardId(prefix: "wt" | "card"): string {
  const short = crypto.randomBytes(4).toString("hex");
  return `${prefix}-${Date.now().toString(36)}-${short}`;
}

function normalizeLeafBlock(block: LeafUiBlock, codeCounter: { count: number }): LeafUiBlock {
  if (block.type === "steps") {
    return {
      ...block,
      items: block.items.map((item, idx) => ({
        ...item,
        number: item.number ?? idx + 1,
      })),
    };
  }
  if (block.type === "code") {
    const defaultOpen = block.defaultOpen ?? codeCounter.count === 0;
    codeCounter.count += 1;
    return {
      ...block,
      startLine: block.startLine ?? 1,
      defaultOpen,
    };
  }
  if (block.type === "mermaid") {
    return {
      ...block,
      code: block.code.trim(),
    };
  }
  if (block.type === "diff") {
    return {
      ...block,
      patch: block.patch.replace(/\r\n/g, "\n"),
      defaultOpen: block.defaultOpen ?? true,
    };
  }
  if (block.type === "findings") {
    return {
      ...block,
      items: block.items.map((item, idx) => ({
        ...item,
        id: item.id ?? `finding-${idx + 1}`,
      })),
    };
  }
  if (block.type === "plan") {
    return {
      ...block,
      steps: block.steps.map((step, idx) => ({
        ...step,
        id: step.id ?? `step-${idx + 1}`,
        defaultChecked: step.defaultChecked ?? !step.optional,
      })),
    };
  }
  return block;
}

export function normalizeWalkthrough(input: {
  title: string;
  subtitle?: string;
  mermaid?: string;
  nodeDetails?: Record<string, MermaidNodeDetail>;
  steps?: StepItem[];
  codeBlocks?: CodeBlock[];
  notes?: string[];
  commentable?: boolean;
  allowCustomInput?: boolean;
}): NormalizedWalkthrough {
  const steps = (input.steps ?? []).map((step, index) => ({
    ...step,
    number: step.number ?? index + 1,
  }));

  const codeBlocks = (input.codeBlocks ?? []).map((block, index) => ({
    ...block,
    startLine: block.startLine ?? 1,
    defaultOpen: block.defaultOpen ?? index === 0,
  }));

  return enforceWalkthroughBudget({
    kind: "walkthrough",
    cardId: createCardId("wt"),
    createdAt: Date.now(),
    title: input.title,
    subtitle: input.subtitle,
    mermaid: input.mermaid?.trim() || undefined,
    nodeDetails: input.nodeDetails,
    steps,
    codeBlocks,
    notes: input.notes ?? [],
    commentable: input.commentable,
    allowCustomInput: input.allowCustomInput,
  });
}

export function normalizeUiCard(input: {
  title: string;
  subtitle?: string;
  blocks: UiBlock[];
  commentable?: boolean;
  allowCustomInput?: boolean;
}): NormalizedUiCard {
  const codeCounter = { count: 0 };
  const blocks: UiBlock[] = input.blocks.map((block) => {
    if (block.type === "tabs") {
      return {
        ...block,
        defaultTab: block.defaultTab ?? block.tabs[0]?.id,
        tabs: block.tabs.map((tab) => ({
          ...tab,
          blocks: tab.blocks.map((leaf) => normalizeLeafBlock(leaf, codeCounter)),
        })),
      };
    }
    return normalizeLeafBlock(block, codeCounter);
  });

  return enforceUiCardBudget({
    kind: "ui_card",
    cardId: createCardId("card"),
    createdAt: Date.now(),
    title: input.title,
    subtitle: input.subtitle,
    blocks,
    commentable: input.commentable,
    allowCustomInput: input.allowCustomInput,
  });
}

function buildWalkthroughSummary(data: NormalizedWalkthrough): string {
  const parts = [
    `已生成逻辑讲解卡片：「${data.title}」`,
    `包含 ${data.steps.length} 个步骤`,
    `${data.codeBlocks.length} 段可折叠源码`,
  ];
  if (data.mermaid) {
    const linked = data.nodeDetails ? Object.keys(data.nodeDetails).length : 0;
    parts.push(linked > 0 ? `1 张可交互 Mermaid 流程图（${linked} 个联动节点）` : "1 张 Mermaid 流程图");
  }
  if (data.truncated) {
    parts.push("（部分超长代码已按 1 MiB 轨迹限制精简）");
  }
  return `${parts.join("，")}。`;
}

function buildUiCardSummary(data: NormalizedUiCard): string {
  const blockCounts = new Map<string, number>();
  for (const block of data.blocks) {
    blockCounts.set(block.type, (blockCounts.get(block.type) ?? 0) + 1);
  }
  const summaryParts = Array.from(blockCounts.entries()).map(([k, v]) => `${k}×${v}`);
  return `已生成声明式交互卡片：「${data.title}」（组件：${summaryParts.join("、")}）。${
    data.truncated ? "（部分超长内容已按体积限制自动精简）" : ""
  }`;
}

function buildAnySummary(data: StoredPayload): string {
  return data.kind === "ui_card" ? buildUiCardSummary(data) : buildWalkthroughSummary(data);
}

async function loadAppHtml(): Promise<string> {
  const overridePath = process.env.WALKTHROUGH_APP_HTML;
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const htmlPath = overridePath
    ? path.resolve(overridePath)
    : path.resolve(currentDir, "./ui/index.html");

  return fs.readFile(htmlPath, "utf-8");
}

const server = new McpServer({
  name: "visual-walkthrough",
  version: PLUGIN_VERSION,
});

registerAppResource(
  server,
  "Logic Walkthrough App",
  APP_URI,
  {
    description: "结构化源码逻辑讲解卡片与声明式交互组件卡片渲染器",
    mimeType: RESOURCE_MIME_TYPE,
    _meta: {
      ui: {
        prefersBorder: false,
      },
    },
  },
  async () => {
    const html = await loadAppHtml();
    return {
      contents: [
        {
          uri: APP_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
          _meta: {
            ui: {
              prefersBorder: false,
            },
          },
        },
      ],
    };
  },
);

registerAppTool(
  server,
  "render_logic_walkthrough",
  {
    title: "渲染源码逻辑讲解卡片",
    description:
      "将多步骤业务代码或流水线逻辑渲染为带 Mermaid 缩放与节点联动流程图、精准步骤行号与可折叠源码的交互卡片。",
    inputSchema: WalkthroughInputShape,
    _meta: {
      ui: {
        resourceUri: APP_URI,
      },
    },
  },
  async (args) => {
    const normalized = normalizeWalkthrough(args);
    await storage.saveCard(normalized);
    return {
      content: [{ type: "text", text: buildWalkthroughSummary(normalized) }],
      structuredContent: { ...normalized, surfaceHint: "inline" },
    };
  },
);

registerAppTool(
  server,
  "render_ui_card",
  {
    title: "渲染声明式交互组件卡片",
    description:
      "自由组合 13 类研发交互积木（table/callout/mermaid/steps/code/text/actions/tabs/metrics/diff/findings/plan/decision），支持行内批注、暂存队列同步至输入框 Context Pill 与一键汇总发送。",
    inputSchema: UiCardInputShape,
    _meta: {
      ui: {
        resourceUri: APP_URI,
      },
    },
  },
  async (args) => {
    const normalized = normalizeUiCard(args);
    await storage.saveCard(normalized);
    return {
      content: [{ type: "text", text: buildUiCardSummary(normalized) }],
      structuredContent: { ...normalized, surfaceHint: "inline" },
    };
  },
);

registerAppTool(
  server,
  "open_walkthrough_pane",
  {
    title: "打开逻辑讲解侧栏工作台",
    description:
      "在侧栏打开无高度限制的卡片工作台；传入空对象 {} 时自动加载最近一张历史卡片，并支持切换历史记录与 Mini Gallery 示例。",
    inputSchema: OptionalWalkthroughInputShape,
    _meta: {
      ui: {
        resourceUri: APP_URI,
      },
      "com.google.antigravity/ui": {
        entrypoints: [
          {
            type: "aux_pane",
            title: "Logic Walkthrough",
          },
        ],
      },
    },
  },
  async (args) => {
    let payload: StoredPayload;
    if (args.title) {
      payload = normalizeWalkthrough({
        title: args.title,
        subtitle: args.subtitle,
        mermaid: args.mermaid,
        nodeDetails: args.nodeDetails,
        steps: args.steps,
        codeBlocks: args.codeBlocks,
        notes: args.notes,
        commentable: args.commentable,
        allowCustomInput: args.allowCustomInput,
      });
      await storage.saveCard(payload);
    } else {
      payload = (await storage.getLatestCard()) ?? DEFAULT_DEMO_PAYLOAD;
    }

    const history = await storage.listHistory();
    const enriched: StoredPayload = {
      ...payload,
      surfaceHint: "aux_pane",
      history,
    };

    return {
      content: [{ type: "text", text: buildAnySummary(payload) }],
      structuredContent: enriched,
    };
  },
);

// 以下为严格仅限 App 调用的隐藏工具（visibility: ["app"]），模型不可见
registerAppTool(
  server,
  "app_list_history",
  {
    title: "列出历史卡片与组件示例",
    description: "App-only: 返回持久化的最近 30 张卡片摘要及内置 Mini Gallery 列表。",
    inputSchema: {},
    _meta: {
      ui: {
        visibility: ["app"],
      },
    },
  },
  async () => {
    const history = await storage.listHistory();
    const gallery = MINI_GALLERY.map((item) => ({
      id: item.id,
      label: item.label,
      description: item.description,
    }));
    return {
      content: [{ type: "text", text: `历史卡片 ${history.length} 张，内置示例 ${gallery.length} 个。` }],
      structuredContent: {
        persistent: storage.persistent,
        history,
        gallery,
      },
    };
  },
);

registerAppTool(
  server,
  "app_get_card",
  {
    title: "读取单张历史卡片或示例卡片",
    description: "App-only: 按 cardId 从插件数据目录或内置 Gallery 加载完整卡片及草稿。",
    inputSchema: AppGetCardInputShape,
    _meta: {
      ui: {
        visibility: ["app"],
      },
    },
  },
  async (args) => {
    const card = args.cardId.startsWith("gallery:")
      ? findGalleryPayload(args.cardId)
      : await storage.getCardById(args.cardId);

    if (!card) {
      return {
        isError: true,
        content: [{ type: "text", text: `未找到卡片：${args.cardId}` }],
      };
    }

    const history = await storage.listHistory();
    return {
      content: [{ type: "text", text: `已加载卡片：「${card.title}」` }],
      structuredContent: {
        ...card,
        surfaceHint: "aux_pane",
        history,
      },
    };
  },
);

registerAppTool(
  server,
  "app_save_draft",
  {
    title: "持久化卡片批注草稿",
    description: "App-only: 在无 teardown 通知的宿主中实时保存用户在卡片内的勾选、批注与补充输入。",
    inputSchema: AppSaveDraftInputShape,
    _meta: {
      ui: {
        visibility: ["app"],
      },
    },
  },
  async (args) => {
    await storage.saveDraft({
      cardId: args.cardId,
      updatedAt: Date.now(),
      queued: args.queued,
      comments: args.comments,
      customNote: args.customNote,
    });
    return {
      content: [{ type: "text", text: "草稿已保存" }],
      structuredContent: { ok: true, persistent: storage.persistent },
    };
  },
);

async function main() {
  await storage.init();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[visual-walkthrough] Fatal MCP server error:", err);
  process.exit(1);
});
