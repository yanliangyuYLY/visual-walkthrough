// Author: a
import { z } from "zod";

const ToneSchema = z.enum(["good", "warn", "bad", "info", "neutral"]);
const CalloutToneSchema = z.enum(["good", "info", "warn", "bad"]);
const SeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const StepItemSchema = z.object({
  number: z.number().int().positive().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  fileRef: z.string().optional(),
  fileUri: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
});

export const CodeBlockSchema = z.object({
  title: z.string().min(1),
  fileRef: z.string().optional(),
  fileUri: z.string().optional(),
  language: z.string().optional(),
  startLine: z.number().int().positive().optional(),
  code: z.string(),
  defaultOpen: z.boolean().optional(),
});

export const MermaidNodeDetailSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().min(1),
  stepNumber: z.number().int().positive().optional(),
  fileRef: z.string().optional(),
  fileUri: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
});

const CellBadgeSchema = z.object({
  badge: z.string().min(1),
  tone: ToneSchema.optional(),
});

const CellCodeSchema = z.object({
  code: z.string(),
});

const CellFileSchema = z.object({
  fileRef: z.string().min(1),
  fileUri: z.string().optional(),
});

export const CellSchema = z.union([
  z.string(),
  CellBadgeSchema,
  CellCodeSchema,
  CellFileSchema,
]);

export const ActionButtonSchema = z.object({
  label: z.string().min(1),
  variant: z.enum(["primary", "secondary", "danger"]).optional(),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("send"), text: z.string().min(1) }),
    z.object({
      type: z.literal("queue"),
      text: z.string().min(1),
      label: z.string().min(1).optional(),
    }),
    z.object({ type: z.literal("copy"), text: z.string().min(1) }),
    z.object({ type: z.literal("open_file"), fileUri: z.string().min(1) }),
  ]),
});

const MetricItemSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  delta: z.string().optional(),
  tone: ToneSchema.optional(),
});

const FindingItemSchema = z.object({
  id: z.string().min(1).optional(),
  severity: SeveritySchema,
  title: z.string().min(1),
  fileRef: z.string().optional(),
  fileUri: z.string().optional(),
  line: z.number().int().positive().optional(),
  rule: z.string().optional(),
  detail: z.string().optional(),
  fix: z.string().optional(),
  fixIsDiff: z.boolean().optional(),
  defaultSelected: z.boolean().optional(),
});

const PlanFileRefSchema = z.object({
  fileRef: z.string().min(1),
  fileUri: z.string().optional(),
});

const PlanStepItemSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  detail: z.string().optional(),
  files: z.array(PlanFileRefSchema).optional(),
  risk: RiskLevelSchema.optional(),
  estimate: z.string().optional(),
  optional: z.boolean().optional(),
  defaultChecked: z.boolean().optional(),
});

const DecisionCriterionSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(1).max(5).optional(),
  note: z.string().optional(),
});

const DecisionOptionSchema = z.object({
  name: z.string().min(1),
  scores: z.array(z.number().min(0).max(10)).min(1),
  pros: z.array(z.string().min(1)).optional(),
  cons: z.array(z.string().min(1)).optional(),
  note: z.string().optional(),
  recommended: z.boolean().optional(),
  actionText: z.string().min(1).optional(),
});

export const LeafBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("table"),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(CellSchema)),
    commentable: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("callout"),
    title: z.string().optional(),
    text: z.string().min(1),
    tone: CalloutToneSchema.optional(),
  }),
  z.object({
    type: z.literal("mermaid"),
    code: z.string().min(1),
    nodeDetails: z.record(z.string(), MermaidNodeDetailSchema).optional(),
  }),
  z.object({
    type: z.literal("steps"),
    items: z.array(StepItemSchema).min(1),
    commentable: z.boolean().optional(),
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
  z.object({
    type: z.literal("metrics"),
    items: z.array(MetricItemSchema).min(1).max(6),
  }),
  z.object({
    type: z.literal("diff"),
    title: z.string().optional(),
    fileRef: z.string().optional(),
    fileUri: z.string().optional(),
    patch: z.string().min(1),
    defaultOpen: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("findings"),
    title: z.string().optional(),
    items: z.array(FindingItemSchema).min(1),
    commentable: z.boolean().optional(),
    selectable: z.boolean().optional(),
    submitLabel: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("plan"),
    title: z.string().optional(),
    steps: z.array(PlanStepItemSchema).min(1),
    commentable: z.boolean().optional(),
    submitLabel: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("decision"),
    criteria: z.array(DecisionCriterionSchema).min(1).max(8),
    options: z.array(DecisionOptionSchema).min(2).max(6),
    submitLabel: z.string().min(1).optional(),
  }),
]);

export const TabsBlockSchema = z.object({
  type: z.literal("tabs"),
  defaultTab: z.string().min(1).optional(),
  tabs: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        badge: z.string().optional(),
        blocks: z.array(LeafBlockSchema).min(1),
      }),
    )
    .min(1)
    .max(6),
});

// 单层非递归联合，确保 JSON Schema 扁平无 $ref 循环
export const BlockSchema = z.union([LeafBlockSchema, TabsBlockSchema]);

export const WalkthroughInputShape = {
  title: z.string().min(1).describe("逻辑讲解卡片标题"),
  subtitle: z.string().optional().describe("可选副标题或入口模块说明"),
  mermaid: z.string().optional().describe("可选 Mermaid 流程图代码（推荐 flowchart LR 或 TD）"),
  nodeDetails: z
    .record(z.string(), MermaidNodeDetailSchema)
    .optional()
    .describe("可选 Mermaid 节点 ID 到点击说明/关联步骤/文件跳转的映射"),
  steps: z.array(StepItemSchema).optional().describe("分步逻辑拆解列表"),
  codeBlocks: z.array(CodeBlockSchema).optional().describe("可折叠源码片段列表"),
  notes: z.array(z.string()).optional().describe("可选补充说明或注意事项"),
  commentable: z.boolean().optional().describe("是否允许对步骤行内添加批注并暂存到输入框上下文"),
  allowCustomInput: z.boolean().optional().describe("是否在底部显示自由补充反馈输入框"),
};

export const UiCardInputShape = {
  title: z.string().min(1).describe("交互卡片标题"),
  subtitle: z.string().optional().describe("可选副标题"),
  blocks: z.array(BlockSchema).min(1).describe("按顺序渲染的声明式组件块列表（支持 13 种积木）"),
  commentable: z.boolean().optional().describe("卡片级默认批注开关"),
  allowCustomInput: z.boolean().optional().describe("是否在卡片底部提供自由补充反馈输入框"),
};

export const OptionalWalkthroughInputShape = {
  title: z.string().min(1).optional().describe("可选卡片标题，不传时复用最近一次历史卡片或展示示例"),
  subtitle: z.string().optional(),
  mermaid: z.string().optional(),
  nodeDetails: z.record(z.string(), MermaidNodeDetailSchema).optional(),
  steps: z.array(StepItemSchema).optional(),
  codeBlocks: z.array(CodeBlockSchema).optional(),
  notes: z.array(z.string()).optional(),
  commentable: z.boolean().optional(),
  allowCustomInput: z.boolean().optional(),
};

export const AppGetCardInputShape = {
  cardId: z.string().min(1).describe("要读取的历史卡片 ID 或内置 Gallery 示例 ID（gallery:*）"),
};

export const AppSaveDraftInputShape = {
  cardId: z.string().min(1),
  queued: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string(),
        text: z.string(),
      }),
    )
    .max(50),
  comments: z.record(
    z.string(),
    z.object({
      label: z.string(),
      text: z.string(),
    }),
  ),
  customNote: z.string().max(4000),
};
