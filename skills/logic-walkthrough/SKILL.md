---
name: logic-walkthrough
description: 将多步骤业务代码、状态机、数据解析流水线或刚完成的核心逻辑链路渲染为可交互的源码逻辑讲解卡片（包含可缩放 Mermaid 流程图、精确行号跳转与可折叠源码块）。
---

# 逻辑讲解卡片（Logic Walkthrough）

当需要向用户解释多步骤代码执行流程、模块间数据流转、状态机或刚实现的复杂逻辑时，使用 MCP 工具 `render_logic_walkthrough` 输出结构化逻辑卡片，代替冗长的纯文本大段解释。

## 执行步骤

1. **核实真实源码与行号**：
   - 使用只读搜索与文件读取工具确认真实的文件路径、函数名、关键分支与准确起止行号，严禁凭空猜测或虚构行号。
2. **组织结构化数据**：
   - `title`：简明概括本次讲解的主题（如 `粘贴板识别逻辑（仅提取 realName / phone / idNumber）`）。
   - `subtitle`：可选，补充入口文件或调用上下文。
   - `mermaid`：推荐提供简洁的 `flowchart LR` 或 `flowchart TD`。节点文本中需要换行时使用 `<br/>`（不要使用孤立的字面 `\n`）。尽量控制在 4~10 个核心节点内，保持清晰易读。
   - `steps`：提炼 3~6 个关键步骤，每个步骤包含：
     - `title`：如 `Step 1: 文本预处理`
     - `description`：精准简洁说明做了什么，行内符号用反引号包裹（如 `` `normalizeText` ``）
     - `fileRef`：相对工作区的可读引用（如 `src/stuInfo/clipboardParser.ts:52-58`）
     - `fileUri`：可选，提供对应文件的绝对 `file://` URI（有工作区真实路径时务必提供，方便用户在卡片内点击直接跳转侧栏打开文件）
   - `codeBlocks`：挑选 1~2 段最核心的入口或关键分支代码，提供：
     - `title`：如 `主入口代码 (clipboardParser.ts:290-301)`
     - `fileRef` / `fileUri`：同上
     - `startLine`：代码段起始真实行号（UI 会据此渲染对齐行号）
     - `code`：真实源码原文（不要擅自删改或省略成伪代码）
     - `defaultOpen`：第一段核心入口代码设为 `true`，其余可设为 `false`
3. **调用工具并精简回复**：
   - 调用 `render_logic_walkthrough`（归属 `visual-walkthrough` 插件的 `walkthrough` 服务）。
   - 工具渲染完成后，正文中只需给出 1~2 句核心结论或下一步建议，不要把卡片里的步骤和代码再次重复贴到正文中。
