// Author: a
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
import { z } from "zod";

const APP_URI = "ui://visual-walkthrough/app.html";
const MAX_PAYLOAD_BYTES = 750 * 1024; // 留足余量，避免触发 1 MiB 轨迹上限

const StepItemSchema = z.object({
  number: z.number().int().positive().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  fileRef: z.string().optional(),
  fileUri: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
});

const CodeBlockSchema = z.object({
  title: z.string().min(1),
  fileRef: z.string().optional(),
  fileUri: z.string().optional(),
  language: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  code: z.string(),
  defaultOpen: z.boolean().optional(),
});

const CellBadgeSchema = z.object({
  badge: z.string().min(1),
  tone: z.enum(["good", "warn", "bad", "info", "neutral"]).optional(),
});

const CellCodeSchema = z.object({
  code: z.string(),
});

const CellFileSchema = z.object({
  fileRef: z.string().min(1),
  fileUri: z.string().optional(),
});

const CellSchema = z.union([
  z.string(),
  CellBadgeSchema,
  CellCodeSchema,
  CellFileSchema,
]);

const ActionButtonSchema = z.object({
  label: z.string().min(1),
  variant: z.enum(["primary", "secondary", "danger"]).optional(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("send"), text: z.string().min(1) }),
    z.object({ type: z.literal("copy"), text: z.string().min(1) }),
    z.object({ type: z.literal("open_file"), fileUri: z.string().min(1) }),
  ]),
});

const BlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("table"),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(CellSchema)),
  }),
  z.object({
    type: z.literal("callout"),
    title: z.string().optional(),
    text: z.string().min(1),
    tone: z.enum(["good", "info", "warn", "bad"]).optional(),
  }),
  z.object({
    type: z.literal("mermaid"),
    code: z.string().min(1),
  }),
  z.object({
    type: z.literal("steps"),
    items: z.array(StepItemSchema).min(1),
  }),
  z.object({
    type: z.literal("code"),
    title: z.string().min(1),
    fileRef: z.string().optional(),
    fileUri: z.string().optional(),
    language: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    code: z.string(),
    defaultOpen: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("text"),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal("actions"),
    buttons: z.array(ActionButtonSchema).min(1),
  }),
]);

const WalkthroughInputShape = {
  title: z.string().min(1).describe("逻辑讲解卡片标题"),
  subtitle: z.string().optional().describe("可选副标题或入口模块说明"),
  mermaid: z.string().optional().describe("可选 Mermaid 流程图代码（推荐 flowchart LR 或 TD）"),
  steps: z.array(StepItemSchema).optional().describe("分步逻辑拆解列表"),
  codeBlocks: z.array(CodeBlockSchema).optional().describe("可折叠源码片段列表"),
  notes: z.array(z.string()).optional().describe("可选补充说明或注意事项"),
};

const UiCardInputShape = {
  title: z.string().min(1).describe("交互卡片标题"),
  subtitle: z.string().optional().describe("可选副标题"),
  blocks: z.array(BlockSchema).min(1).describe("按顺序渲染的声明式组件块列表"),
};

const OptionalWalkthroughInputShape = {
  title: z.string().min(1).optional().describe("可选卡片标题，不传时复用最近一次或展示示例"),
  subtitle: z.string().optional(),
  mermaid: z.string().optional(),
  steps: z.array(StepItemSchema).optional(),
  codeBlocks: z.array(CodeBlockSchema).optional(),
  notes: z.array(z.string()).optional(),
};

type StepItem = z.infer<typeof StepItemSchema>;
type CodeBlock = z.infer<typeof CodeBlockSchema>;
type UiBlock = z.infer<typeof BlockSchema>;

export interface NormalizedWalkthrough {
  [key: string]: unknown;
  kind: "walkthrough";
  title: string;
  subtitle?: string;
  mermaid?: string;
  steps: Array<StepItem & { number: number }>;
  codeBlocks: Array<CodeBlock & { startLine: number; defaultOpen: boolean }>;
  notes: string[];
  truncated?: boolean;
}

export interface NormalizedUiCard {
  [key: string]: unknown;
  kind: "ui_card";
  title: string;
  subtitle?: string;
  blocks: UiBlock[];
  truncated?: boolean;
}

type StoredPayload = NormalizedWalkthrough | NormalizedUiCard;

const DEFAULT_DEMO_PAYLOAD: NormalizedWalkthrough = {
  kind: "walkthrough",
  title: "Logic Walkthrough 逻辑讲解面板（示例）",
  subtitle: "在对话中调用 render_logic_walkthrough 或 render_ui_card 后，此处会自动更新为真实卡片",
  mermaid: [
    "flowchart LR",
    '  A["1. 接收输入参数"] --> B["2. 校验与规范化<br/>normalizePayload"]',
    '  B --> C["3. 渲染 Mermaid 流程图"]',
    '  C --> D["4. 输出步骤与折叠源码"]',
  ].join("\n"),
  steps: [
    {
      number: 1,
      title: "Step 1: 采集真实代码与行号",
      description:
        "先通过只读工具核实文件路径与起止行号，提炼关键函数如 `normalizePayload`，确保每条引用真实存在。",
      fileRef: "server/src/server.ts",
    },
    {
      number: 2,
      title: "Step 2: 渲染可缩放流程图",
      description:
        "支持右上角 `-` / `100%` / `+` 缩放、鼠标拖拽平移、`Mermaid` 查看源码及全屏展开。",
    },
    {
      number: 3,
      title: "Step 3: 侧栏联动与折叠源码",
      description:
        "点击带真实 `file://` URI 的文件引用可直接在侧栏打开对应文件，折叠代码区支持复制与真实行号对齐。",
    },
  ],
  codeBlocks: [
    {
      title: "示例入口代码 (server.ts)",
      fileRef: "server/src/server.ts",
      language: "typescript",
      startLine: 1,
      defaultOpen: true,
      code: [
        "export function normalizeWalkthrough(raw: RawInput): NormalizedWalkthrough {",
        "  // 1. 补全步骤序号与代码块起始行号",
        "  // 2. 限制单次返回体积在 750 KiB 以内",
        "  return enforcePayloadBudget(raw);",
        "}",
      ].join("\n"),
    },
  ],
  notes: ["提示：这是一个占位示例。请让 AI 分析具体代码后调用 render_logic_walkthrough 或 render_ui_card。"],
};

let latestPayload: StoredPayload | null = null;

function measureJsonBytes(data: unknown): number {
  return Buffer.byteLength(JSON.stringify(data), "utf-8");
}

function truncateCodeText(code: string, maxLines = 40, maxChars = 4000): string {
  const lines = code.split("\n");
  if (lines.length > maxLines) {
    return (
      lines.slice(0, maxLines).join("\n") +
      "\n// ...（源码过长已按轨迹体积限制截断，点击上方文件路径可在侧栏查看完整文件）"
    );
  }
  if (code.length > maxChars) {
    return code.slice(0, maxChars) + "\n// ...（已截断）";
  }
  return code;
}

function enforceWalkthroughBudget(payload: NormalizedWalkthrough): NormalizedWalkthrough {
  if (measureJsonBytes(payload) <= MAX_PAYLOAD_BYTES) {
    return payload;
  }

  const trimmed: NormalizedWalkthrough = {
    ...payload,
    codeBlocks: payload.codeBlocks.map((block) => ({ ...block })),
    truncated: true,
  };

  for (let i = trimmed.codeBlocks.length - 1; i >= 0 && measureJsonBytes(trimmed) > MAX_PAYLOAD_BYTES; i--) {
    trimmed.codeBlocks[i].code = truncateCodeText(trimmed.codeBlocks[i].code);
  }

  if (measureJsonBytes(trimmed) > MAX_PAYLOAD_BYTES) {
    trimmed.notes = [
      ...trimmed.notes,
      "部分超长代码内容已自动精简，以符合单次工具结果体积限制。",
    ];
    while (trimmed.codeBlocks.length > 1 && measureJsonBytes(trimmed) > MAX_PAYLOAD_BYTES) {
      trimmed.codeBlocks.pop();
    }
  }

  return trimmed;
}

function enforceUiCardBudget(payload: NormalizedUiCard): NormalizedUiCard {
  if (measureJsonBytes(payload) <= MAX_PAYLOAD_BYTES) {
    return payload;
  }

  const trimmed: NormalizedUiCard = {
    ...payload,
    blocks: payload.blocks.map((block) => ({ ...block })),
    truncated: true,
  };

  for (let i = trimmed.blocks.length - 1; i >= 0 && measureJsonBytes(trimmed) > MAX_PAYLOAD_BYTES; i--) {
    const block = trimmed.blocks[i];
    if (block.type === "code") {
      trimmed.blocks[i] = {
        ...block,
        code: truncateCodeText(block.code),
      };
    }
  }

  if (measureJsonBytes(trimmed) > MAX_PAYLOAD_BYTES) {
    trimmed.blocks.push({
      type: "callout",
      tone: "info",
      title: "体积保护提示",
      text: "部分超长代码块已按单次工具结果体积限制自动精简。",
    });
  }

  return trimmed;
}

function normalizeWalkthrough(input: {
  title: string;
  subtitle?: string;
  mermaid?: string;
  steps?: StepItem[];
  codeBlocks?: CodeBlock[];
  notes?: string[];
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
    title: input.title,
    subtitle: input.subtitle,
    mermaid: input.mermaid?.trim() || undefined,
    steps,
    codeBlocks,
    notes: input.notes ?? [],
  });
}

function normalizeUiCard(input: {
  title: string;
  subtitle?: string;
  blocks: UiBlock[];
}): NormalizedUiCard {
  let codeBlockCount = 0;
  const blocks: UiBlock[] = input.blocks.map((block) => {
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
      const defaultOpen = block.defaultOpen ?? codeBlockCount === 0;
      codeBlockCount += 1;
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
    return block;
  });

  return enforceUiCardBudget({
    kind: "ui_card",
    title: input.title,
    subtitle: input.subtitle,
    blocks,
  });
}

function buildWalkthroughSummary(data: NormalizedWalkthrough): string {
  const parts = [
    `已生成逻辑讲解卡片：「${data.title}」`,
    `包含 ${data.steps.length} 个步骤`,
    `${data.codeBlocks.length} 段可折叠源码`,
  ];
  if (data.mermaid) {
    parts.push("1 张 Mermaid 流程图");
  }
  if (data.truncated) {
    parts.push("（部分超长代码块已按体积限制精简）");
  }
  return parts.join("，") + "。";
}

function buildUiCardSummary(data: NormalizedUiCard): string {
  const blockCounts = new Map<string, number>();
  for (const block of data.blocks) {
    blockCounts.set(block.type, (blockCounts.get(block.type) ?? 0) + 1);
  }
  const summaryParts = Array.from(blockCounts.entries()).map(([k, v]) => `${k}×${v}`);
  return `已生成声明式交互卡片：「${data.title}」（组件：${summaryParts.join("、")}）。${
    data.truncated ? "（部分超长代码块已自动精简）" : ""
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
  version: "1.1.0",
});

registerAppResource(
  server,
  "Logic Walkthrough App",
  APP_URI,
  {
    description: "结构化源码逻辑讲解卡片与声明式交互卡片渲染器",
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
      "将多步骤业务代码或流水线逻辑渲染为带 Mermaid 缩放流程图、精准步骤行号与可折叠源码的交互卡片。",
    inputSchema: WalkthroughInputShape,
    _meta: {
      ui: {
        resourceUri: APP_URI,
      },
    },
  },
  async (args) => {
    const normalized = normalizeWalkthrough(args);
    latestPayload = normalized;
    return {
      content: [{ type: "text", text: buildWalkthroughSummary(normalized) }],
      structuredContent: normalized,
    };
  },
);

registerAppTool(
  server,
  "render_ui_card",
  {
    title: "渲染声明式交互组件卡片",
    description:
      "自由组合表格（含状态徽章）、结论/建议提示框（Callout）、Mermaid 流程图、步骤列表、折叠源码以及可触发 Send 对话回调的操作按钮行，并附带 Spec Source 查看。",
    inputSchema: UiCardInputShape,
    _meta: {
      ui: {
        resourceUri: APP_URI,
      },
    },
  },
  async (args) => {
    const normalized = normalizeUiCard(args);
    latestPayload = normalized;
    return {
      content: [{ type: "text", text: buildUiCardSummary(normalized) }],
      structuredContent: normalized,
    };
  },
);

registerAppTool(
  server,
  "open_walkthrough_pane",
  {
    title: "打开逻辑讲解侧栏面板",
    description:
      "在侧栏打开卡片面板；支持传入空对象 {} 以展示最近一次生成的逻辑卡片/声明式交互卡片或内置示例。",
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
    const payload: StoredPayload = args.title
      ? normalizeWalkthrough({
          title: args.title,
          subtitle: args.subtitle,
          mermaid: args.mermaid,
          steps: args.steps,
          codeBlocks: args.codeBlocks,
          notes: args.notes,
        })
      : (latestPayload ?? DEFAULT_DEMO_PAYLOAD);

    if (args.title) {
      latestPayload = payload;
    }

    return {
      content: [{ type: "text", text: buildAnySummary(payload) }],
      structuredContent: payload,
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[visual-walkthrough] Fatal MCP server error:", err);
  process.exit(1);
});
