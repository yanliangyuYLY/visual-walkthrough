---
name: ui-card
description: 使用声明式组件引擎（表格、状态徽章、Callout 提示框、Mermaid 流程图、步骤、折叠源码与支持发回对话的 Send 按钮行）渲染排查报告、方案对比与交互决策卡片。
---

# 声明式交互组件卡片（UI Card）

当需要向用户展示**逐项排查报告、字段状态对比、多方案决策选择**，或希望给用户提供**点击即可发回对话执行下一步的按钮**时，调用 MCP 工具 `render_ui_card`。

## 组件积木清单（`blocks` 数组按顺序渲染）

1. **`table`（排查/对比表格）**：
   - `columns`: 列标题数组（如 `["字段", "文本内容", "未识别原因"]`）。
   - `rows`: 二维数组，单元格支持：
     - 纯字符串 `"18409787715"`
     - 状态圆点徽章 `{ "badge": "12位，非11位", "tone": "bad" }`（`tone` 可选 `good` | `warn` | `bad` | `info` | `neutral`）
     - 行内代码 `{ "code": "normalizeText" }`
     - 可点击文件链接 `{ "fileRef": "src/parser.ts:52", "fileUri": "file:///..." }`
2. **`callout`（结论 / 提示 / 建议框）**：
   - `tone`: `"good"`（验证通过/结论）、`"info"`（建议优化项/说明）、`"warn"`（风险提示）、`"bad"`（阻断错误）。
   - `title`: 标题，如 `实测验证结论`、`建议优化项`。
   - `text`: 正文（支持 `\n` 换行及反引号 `` `code` `` 行内高亮）。
3. **`actions`（底部决策按钮行）**：
   - `buttons`: 建议提供 2~4 个清晰互斥的决策按钮，推荐项设为 `"variant": "primary"`，其余为 `"secondary"`（高危操作可用 `"danger"`）。
   - `action` 支持三种类型：
     - `{"type": "send", "text": "..."}`：点击后通过官方 `app.sendMessage()` 将 `text` 作为用户消息直接发回当前对话驱动 AI 继续执行！**`text` 必须写成完整、无歧义的可执行指令**（例如 `"修改 clipboardParser.ts：1. 无标签身份证号增加省码+合法出生日期兜底；2. 无标签姓名分词增加数字边界拆分"`，不要写模糊的 `"选第一个"`）。
     - `{"type": "copy", "text": "..."}`：一键复制到剪贴板。
     - `{"type": "open_file", "fileUri": "file:///..."}`：在侧栏打开对应文件。
4. **`mermaid` / `steps` / `code` / `text`**：
   - 也可在同一卡片中自由混排可缩放 `mermaid` 流程图、带行号跳转的 `steps`、可折叠 `code` 块和补充 `text` 段落。

## 使用原则

- 所有卡片自带右下角 `<> Source` 按钮，方便用户展开查看/复制本次卡片的类 DSL 源码。
- 工具渲染完成后，正文只保留 1~2 句简短导语或补充，**不要**把表格和建议在正文中重复写一遍。
- 若只是纯粹的源码链路讲解（纯 Mermaid + 步骤 + 折叠代码），优先使用 `render_logic_walkthrough`；若需要表格、Callout 或交互决策按钮，使用 `render_ui_card`。
