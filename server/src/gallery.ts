// Author: a
import type { GalleryEntry, NormalizedWalkthrough } from "./shared/types";

export const DEFAULT_DEMO_PAYLOAD: NormalizedWalkthrough = {
  kind: "walkthrough",
  cardId: "gallery:walkthrough",
  createdAt: 0,
  title: "Logic Walkthrough 逻辑讲解面板（示例）",
  subtitle: "点击流程图节点可联动高亮下方步骤；真实调用后此处会自动保留最近 30 张历史卡片",
  mermaid: [
    "flowchart LR",
    '  A["1. 接收参数"] --> B["2. 校验与裁剪<br/>budget.ts"]',
    '  B --> C["3. 节点联动渲染"]',
    '  C --> D["4. 批注同步 Pill"]',
  ].join("\n"),
  nodeDetails: {
    A: {
      title: "接收工具输入",
      summary: "通过强类型 Zod Schema 校验输入，兼容原有 7 类与新增 6 类研发积木。",
      stepNumber: 1,
      fileRef: "server/src/schema.ts",
    },
    B: {
      title: "递归体积预算保护",
      summary: "递归检查 code、diff、findings 与 tabs 嵌套块，严格控制在 750 KiB 安全线内。",
      stepNumber: 2,
      fileRef: "server/src/budget.ts",
    },
    C: {
      title: "流程图联动交互",
      summary: "点击任意绑定了 nodeDetails 的流程图节点，直接弹出摘要并定位到对应步骤。",
      stepNumber: 3,
    },
    D: {
      title: "双向批注与 Context Pill",
      summary: "用户勾选或添加行内批注后，通过官方 updateModelContext() 同步到输入框 Pill。",
      stepNumber: 4,
    },
  },
  steps: [
    {
      number: 1,
      title: "Step 1: 采集真实源码与行号",
      description:
        "先通过只读工具核实真实路径与起止行号，提炼关键入口如 `normalizeUiCard`，绝不虚构行号。",
      fileRef: "server/src/server.ts",
    },
    {
      number: 2,
      title: "Step 2: 递归体积保护与持久化",
      description:
        "由 `enforceUiCardBudget` 控制返回体量远低于 1 MiB 上限，并写入 `${PLUGIN_DATA}` 保留历史。",
      fileRef: "server/src/budget.ts",
    },
    {
      number: 3,
      title: "Step 3: 节点联动探索",
      description:
        "点击上方流程图任意节点即可展开说明并自动定位高亮本步骤；也可在侧栏查看完整文件。",
    },
    {
      number: 4,
      title: "Step 4: 行内批注与暂存发送",
      description:
        "点击本步骤右侧「批注」输入修改意见，将实时同步到 Antigravity 输入框上下文 Pill，或底部一键发送。",
    },
  ],
  codeBlocks: [
    {
      title: "递归体积保护示例 (budget.ts)",
      fileRef: "server/src/budget.ts",
      language: "typescript",
      startLine: 1,
      defaultOpen: true,
      code: [
        "export function enforceUiCardBudget(payload: NormalizedUiCard): NormalizedUiCard {",
        "  if (measureJsonBytes(payload) <= MAX_PAYLOAD_BYTES) return payload;",
        "  // 递归覆盖 code、diff、findings.fix 以及 tabs 内嵌套积木",
        "  return trimNestedBlocks(payload);",
        "}",
      ].join("\n"),
    },
  ],
  notes: ["提示：可在上方下拉栏切换历史卡片或浏览「组件示例（Mini Gallery）」。"],
  commentable: true,
  allowCustomInput: true,
};

export const MINI_GALLERY: GalleryEntry[] = [
  {
    id: "gallery:walkthrough",
    label: "示例 · 逻辑讲解（节点联动）",
    description: "Mermaid 节点点击联动步骤 + 折叠源码 + 行内批注",
    payload: DEFAULT_DEMO_PAYLOAD,
  },
  {
    id: "gallery:review",
    label: "示例 · Code Review（Findings + Diff + Tabs）",
    description: "指标条 + 标签页防 800px 溢出 + 严重度筛选与修复 Diff",
    payload: {
      kind: "ui_card",
      cardId: "gallery:review",
      createdAt: 0,
      title: "Code Review：认证与上传模块排查",
      subtitle: "演示 metrics + tabs + findings + diff + 双向批注汇总",
      commentable: true,
      allowCustomInput: true,
      blocks: [
        {
          type: "metrics",
          items: [
            { label: "发现问题", value: "3 项", tone: "warn" },
            { label: "高危阻断", value: "1 项", delta: "必须修复", tone: "bad" },
            { label: "建议重构", value: "2 项", tone: "info" },
            { label: "单测通过", value: "98%", delta: "+2.4%", tone: "good" },
          ],
        },
        {
          type: "tabs",
          defaultTab: "findings",
          tabs: [
            {
              id: "findings",
              label: "问题清单",
              badge: "3",
              blocks: [
                {
                  type: "findings",
                  selectable: true,
                  commentable: true,
                  submitLabel: "修复已勾选问题",
                  items: [
                    {
                      id: "f1",
                      severity: "high",
                      title: "空邮箱触发 toLowerCase 运行时异常",
                      fileRef: "src/api/users.ts:41",
                      rule: "null-safety",
                      detail: "SSO 首次登录回调未保证 `user.email` 非空，直接调用会抛出 TypeError。",
                      fixIsDiff: true,
                      fix: [
                        "@@ -40,3 +40,3 @@",
                        " export function normalizeEmail(user: User) {",
                        "-  return user.email.toLowerCase();",
                        "+  return (user.email ?? \"\").trim().toLowerCase();",
                        " }",
                      ].join("\n"),
                      defaultSelected: true,
                    },
                    {
                      id: "f2",
                      severity: "medium",
                      title: "重试队列丢失请求元数据",
                      fileRef: "src/worker/queue.ts:88",
                      detail: "`requeue()` 仅重推任务 ID，导致重试阶段 traceId 丢失。",
                      defaultSelected: true,
                    },
                    {
                      id: "f3",
                      severity: "info",
                      title: "可合并重复的状态扫描循环",
                      fileRef: "src/worker/stats.ts:19",
                      detail: "当前数据量下无性能瓶颈，可在后续重构时统一收集。",
                    },
                  ],
                },
              ],
            },
            {
              id: "patch",
              label: "建议补丁 Diff",
              blocks: [
                {
                  type: "diff",
                  title: "修复空邮箱与去空白",
                  fileRef: "src/api/users.ts",
                  defaultOpen: true,
                  patch: [
                    "--- a/src/api/users.ts",
                    "+++ b/src/api/users.ts",
                    "@@ -39,5 +39,6 @@",
                    " export function normalizeEmail(user: User) {",
                    "-  return user.email.toLowerCase();",
                    "+  const raw = user.email ?? \"\";",
                    "+  return raw.trim().toLowerCase();",
                    " }",
                  ].join("\n"),
                },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    id: "gallery:plan",
    label: "示例 · 实施计划审批（Plan + Queue）",
    description: "带风险徽章、可选步骤勾选、行内批注与一键批准",
    payload: {
      kind: "ui_card",
      cardId: "gallery:plan",
      createdAt: 0,
      title: "限流改造实施计划",
      subtitle: "可取消勾选可选步骤、对任意步骤添加批注后再统一批准",
      allowCustomInput: true,
      blocks: [
        {
          type: "plan",
          commentable: true,
          submitLabel: "批准并执行已勾选步骤",
          steps: [
            {
              id: "p1",
              title: "解析上游 429 与 Retry-After 响应头",
              detail: "统一封装退避等待，单次上限 60s；其余 4xx 保持原样透传。",
              files: [{ fileRef: "src/net/http.ts:180" }],
              risk: "medium",
              estimate: "1h",
            },
            {
              id: "p2",
              title: "替换为按 Host 隔离的令牌桶限流器",
              detail: "避免单个慢上游拖垮其余并发请求。",
              files: [{ fileRef: "src/net/limiter.ts" }],
              risk: "high",
              estimate: "2h",
            },
            {
              id: "p3",
              title: "在状态栏展示「限流重试中」微提示",
              detail: "提升弱网体验，可作为可选增强项。",
              files: [{ fileRef: "src/ui/statusBar.ts" }],
              risk: "low",
              estimate: "30m",
              optional: true,
              defaultChecked: false,
            },
          ],
        },
      ],
    },
  },
  {
    id: "gallery:decision",
    label: "示例 · 方案加权对比（Decision）",
    description: "本地拖动维度权重滑块实时重算排序（零 LLM 调用）",
    payload: {
      kind: "ui_card",
      cardId: "gallery:decision",
      createdAt: 0,
      title: "异步任务队列技术选型",
      subtitle: "拖动各维度权重滑块可实时重排综合得分",
      blocks: [
        {
          type: "decision",
          submitLabel: "采用当前首选方案",
          criteria: [
            { name: "吞吐能力", weight: 2, note: "峰值约 40 jobs/s" },
            { name: "运维成本", weight: 4, note: "小团队优先少组件" },
            { name: "事务一致性", weight: 3 },
          ],
          options: [
            {
              name: "pg-boss",
              scores: [4, 5, 5],
              recommended: true,
              pros: ["直接复用现有 Postgres", "与业务行在同一事务提交"],
              cons: ["极高吞吐下轮询存在额外负载"],
              actionText: "采用 pg-boss 方案接入异步任务队列，复用现有 Postgres。",
            },
            {
              name: "BullMQ",
              scores: [5, 2, 3],
              pros: ["延迟极低，原生限流与延迟队列完善"],
              cons: ["需要独立维护持久化 Redis"],
              actionText: "采用 BullMQ + Redis 方案实现异步任务队列。",
            },
          ],
        },
        {
          type: "actions",
          buttons: [
            {
              label: "暂存：先补压测数据",
              variant: "secondary",
              action: {
                type: "queue",
                label: "补充压测",
                text: "在最终定型前，请先补充 pg-boss 与 BullMQ 的本地压测对比脚本。",
              },
            },
          ],
        },
      ],
    },
  },
];

export function findGalleryPayload(cardId: string) {
  return MINI_GALLERY.find((item) => item.id === cardId)?.payload ?? null;
}
