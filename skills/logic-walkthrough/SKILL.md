---
name: logic-walkthrough
description: 将多步骤业务代码、状态机、数据解析流水线或刚完成的核心逻辑链路渲染为可探索的源码逻辑讲解卡片（包含可缩放且支持节点点击联动的 Mermaid 流程图、精确行号跳转、行内批注与可折叠源码块）。
---

# 逻辑讲解卡片（Logic Walkthrough）

当需要向用户解释多步骤代码执行流程、模块间数据流转、状态机或刚实现的复杂逻辑时，使用 MCP 工具 `render_logic_walkthrough` 输出可交互逻辑卡片，代替冗长的纯文本大段解释。

## 执行步骤

1. **核实真实源码与行号**：
   - 使用只读搜索与文件读取工具确认真实的文件路径、函数名、关键分支与准确起止行号，严禁凭空猜测或虚构行号。
2. **组织结构化数据**：
   - `title` / `subtitle`：简明概括本次讲解主题与入口模块。
   - `mermaid`：推荐提供简洁的 `flowchart LR` 或 `flowchart TD`（控制在 4~10 个核心节点内）。节点内换行使用 `<br/>`（不要使用孤立字面 `\n`）。
   - `nodeDetails`（**推荐提供**）：以 Mermaid 节点 ID 为键，提供 `{ title?, summary, stepNumber?, fileRef?, fileUri?, lineStart? }`。用户点击流程图节点时，会弹出节点说明并自动高亮滚动定位到对应 `stepNumber`，支持一键在侧栏打开源文件。
   - `steps`：提炼 3~6 个关键步骤（`title`、`description`、`fileRef`、`fileUri`、`lineStart`、`lineEnd`）。有真实绝对路径时务必提供 `file://` URI。
   - `codeBlocks`：挑选 1~2 段最核心的入口或关键分支真实源码，设置准确 `startLine`（首段 `defaultOpen: true`，其余 `false`）。
   - `commentable` / `allowCustomInput`：当讲解后需要用户对某些步骤提出修改意见或追问时设为 `true`，批注将同步到输入框 Context Pill。
3. **调用工具并精简回复**：
   - 调用 `render_logic_walkthrough`（归属 `visual-walkthrough` 插件的 `walkthrough` 服务）。
   - 卡片会自动持久化到侧栏 `Logic Walkthrough` 工作台历史（保留最近 30 张），方便用户随时通过侧栏 `+` 菜单无高度限制回看或切换 Mini Gallery。
   - 工具渲染完成后，正文中只需给出 1~2 句核心结论或下一步建议，不要把卡片里的步骤和代码再次重复贴到正文中。
