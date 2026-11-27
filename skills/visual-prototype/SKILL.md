---
name: visual-prototype
description: 在设计前端/移动端页面、新增弹窗、状态流转或交互方案时，生成一个符合 Antigravity Generative UI 安全与主题规范的单文件可交互视觉原型。
---

# 可交互视觉原型（Visual Prototype）

当用户需要设计 UI 方案、预览交互细节、对比多种弹窗/异常状态，或在编写业务代码前确认界面交互效果时，生成一个**可直接点击体验的 HTML 视觉原型**。

## 核心设计结构

原型页面应尽量包含以下直观结构：

1. **顶部状态控制条（胶囊按钮组）**：
   - 列出关键交互状态（例如：`1. 正常态`、`2. 操作弹窗`、`3. 冲突/异常态`），当前激活态高亮。
   - 附带一个「重置表单 / 重置状态」按钮，方便用户随时回到初始状态。
2. **沉浸式设备容器**：
   - **移动端/小程序**：居中展示带圆角边框与顶部听筒/状态栏的手机画框（宽度约 `360px`~`390px`）。
   - **桌面 Web/后台**：简洁浏览器顶栏 + 卡片画布。
3. **双向实时联动**：
   - 点击顶部状态胶囊可立即切换画面（如打开对应弹窗、填充演示数据）；
   - 点击手机/页面画面内的真实按钮（如「粘贴填入」「手动粘贴」「确认覆盖」「取消」）同样会同步更新表单值、关闭/切换弹窗，并同步高亮顶部对应的状态胶囊。

## 平台安全与布局红线（必须严格遵守）

1. **使用原生文件工具写入 Artifact 目录**：
   - 使用 `write_file` 将完整单文件 `.html` 写入当前会话的 Artifact 目录（`<appDataDir>/brain/<conversation-id>/`），并附带 `ArtifactMetadata`（`UserFacing: true`, `RequestFeedback: false`, `Summary: "..."`）。
   - 严禁通过 shell 或 Python 脚本写入 Artifact。
2. **CSP 白名单脚本**：
   - 外部 CDN 会被沙箱拦截，仅允许引入官方白名单 Tailwind：
     ```html
     <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
     ```
   - 所有交互逻辑与图标（内联 SVG）必须全部内联在同一 HTML 中，禁止引入其他外部 JS/CSS/字体链接。
3. **宿主主题变量适配**：
   - 必须使用 Antigravity 注入的语义 CSS 变量实现深浅主题自适配：`var(--background)`、`var(--card)`、`var(--card-border)`、`var(--border)`、`var(--foreground)`、`var(--muted-foreground)`、`var(--primary)`、`var(--primary-foreground)`、`var(--success)`、`var(--warning)`、`var(--error)`。
   - 禁止在 `:root` 中覆写颜色变量，禁止使用 `var(--vscode-*)` 或 `var(--app-*)`，避免写死 `bg-white` / `text-black` 导致深色主题失效（手机模拟屏幕内部若特意模拟固定浅色 App 画面，需同时保证文字与背景形成明确对比）。
4. **尺寸与内联规范**：
   - 顶层容器**严禁**使用 `h-screen`、`min-h-screen`、`100vh` 或 `height: 100%`（会导致内联 iframe 高度塌陷）。
   - **内联 vs 独立决策**：
     - 若原型紧凑且整体高度在 `450px` 以内（如横向卡片、局部弹窗），使用 `<agent-embed src="file:///.../prototype.html"></agent-embed>` 内联嵌入对话；
     - 若是完整手机竖屏页面（高度通常大于 `450px`，甚至超过 `600px`），不要硬塞进内联滚动框导致截断，应作为**独立 Artifact**（不使用 `<agent-embed>`），在回复中给出 Artifact 文件链接引导用户在侧栏完整交互体验。
   - `<agent-embed>` 标签上不要设置 `height` 属性。
