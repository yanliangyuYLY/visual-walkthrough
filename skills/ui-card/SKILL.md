---
name: ui-card
description: 使用声明式组件引擎（13 类研发积木：表格、指标条、Tabs、Diff、Findings 审查清单、Plan 实施计划、Decision 加权对比、Callout、Mermaid 节点联动、步骤、折叠源码及支持暂存与 Context Pill 的交互按钮）渲染排查报告、Code Review、实施审批与技术选型卡片。
---

# 声明式交互组件卡片（UI Card）

当需要向用户展示**排查报告、Code Review 问题清单、代码 Diff、实施计划审批、多方案加权选型**，或希望用户**勾选多项、行内批注并汇总发回对话**时，调用 MCP 工具 `render_ui_card`。

## 13 类积木速查（`blocks` 数组按顺序渲染）

### 基础与布局积木
1. **`metrics`**：2~4 列紧凑 KPI 条（`items: [{ label, value, delta?, tone? }]`），一屏呈现统计与前后对比。
2. **`tabs`**：分栏收纳容器（`defaultTab?, tabs: [{ id, label, badge?, blocks }]`，不支持 Tab 套 Tab），**专治内联 800px 高度上限**。
3. **`table`**：排查/对比表格（`columns`, `rows`, `commentable?`），单元格支持纯文本、状态圆点徽章 `{ badge, tone }`、行内代码 `{ code }`、侧栏文件链接 `{ fileRef, fileUri }`。
4. **`callout`**：结论/建议/风险提示框（`tone: "good"|"info"|"warn"|"bad"`, `title?`, `text`）。
5. **`actions`**：操作按钮行（`buttons: [{ label, variant?, action }]`），`action` 支持：
   - `{ type: "send", text }`：立即发回对话（若有已暂存反馈/批注，会自动合并为一条消息一并发送并清空暂存）；**`text` 必须写成完整无歧义指令**。
   - `{ type: "queue", text, label? }`：加入/移出暂存队列并同步到输入框 Context Pill，适合多个独立可选项。
   - `{ type: "copy", text }` / `{ type: "open_file", fileUri }`。
6. **`mermaid` / `steps` / `code` / `text`**：可缩放且支持 `nodeDetails` 节点联动的流程图、带 `commentable` 行内批注的步骤列表、带行号折叠源码与说明文本。

### 研发专用高交互积木
7. **`diff`**：Unified Diff 对比块（`title?`, `fileRef?`, `fileUri?`, `patch`, `defaultOpen?`），红绿增删行与双行号渲染。
8. **`findings`**：代码审查/Bug 清单（`title?`, `items: [{ severity, title, fileRef?, fileUri?, line?, rule?, detail?, fix?, fixIsDiff?, defaultSelected? }]`, `selectable?`, `commentable?`, `submitLabel?`），自带严重度筛选胶囊与一键修复已勾选项。
9. **`plan`**：实施计划审批清单（`title?`, `steps: [{ title, detail?, files?, risk?, estimate?, optional?, defaultChecked? }]`, `commentable?`, `submitLabel?`），支持勾选步骤、行内批注与一键批准执行。
10. **`decision`**：本地加权选型对比器（`criteria: [{ name, weight?, note? }]`, `options: [{ name, scores, pros?, cons?, note?, recommended?, actionText? }]`, `submitLabel?`），用户拖动滑块纯前端重算得分排名，零模型调用。

> 详细字段定义与典型 JSON 示例请按需查阅 [blocks-reference.md](./references/blocks-reference.md)。

## 双向批注与暂存规范

- 当方案或排查项需要用户挑拣或补充意见时，开启 `commentable: true` 与 `allowCustomInput: true`。
- 用户的勾选、批注与补充说明会通过官方 `app.updateModelContext()` 实时同步到输入框 Context Pill，也可点击底部「发送汇总」一次性提交。
- `findings`、`plan`、`decision` 已内置主提交按钮，通常无需再额外堆叠重复的 `actions` 发送按钮。

## 版面紧凑与防溢出规范

Antigravity 对话内联视图高度上限为 `800px`，单次工具结果体积上限为 `1 MiB`：
1. **善用 `tabs` 分栏**：当卡片同时包含流程图、问题表和代码/Diff 时，优先放入 `tabs` 的不同标签页，确保首屏无需滚动即可完整阅读。
2. **表格精简在 3~4 列**：避免 5 列以上把说明列挤窄拉高；文案保持 1~2 句直击重点。
3. **不重复刷屏**：工具渲染完成后，正文只保留 1~2 句导语或关键结论，不要在正文复述卡片内的表格与列表。
4. **超大内容引导侧栏**：需要无高度限制全屏浏览或回顾历史卡片时，引导用户通过侧栏 `+` 菜单打开 `Logic Walkthrough`（`aux_pane`）。
