# Visual Walkthrough

作者：`a` · 协议：[MIT License](./LICENSE)

**Visual Walkthrough** 是一个符合 Antigravity 官方插件架构与安全规范的跨平台混合一体插件，用于在对话中主动或按需输出三类高交互可视化内容：

1. **声明式交互组件卡片（MCP App — `render_ui_card`）**
   - 自由组合 `table`（含彩色圆点 `badge`、行内代码、可点击文件引用）、`callout`（`good` / `info` / `warn` / `bad`）、`mermaid`、`steps`、`code`、`text` 与 `actions` 按钮行。
   - **对话回调**：`send` 按钮通过官方 `@modelcontextprotocol/ext-apps` 的 `app.sendMessage()` 直接把下一步指令发回当前对话继续执行；支持 `copy` 一键复制与 `open_file`（`toggle-aux-pane`）侧栏跳转源码。
   - **Spec 源码查看**：卡片右下角提供 `<> Source` 开关，展示类 DSL 源码并支持复制。

2. **逻辑讲解卡片（MCP App — `render_logic_walkthrough` / `open_walkthrough_pane`）**
   - 内置可缩放（`-` / `100%` / `+`）、拖拽平移、源码切换与展开的 **Mermaid** 流程图。
   - 带精准行号跳转的步骤拆解列表与可折叠真实源码卡片，支持 `aux_pane` 侧栏打开。

3. **可交互视觉原型（Skill + Generative UI）**
   - `skills/visual-prototype/SKILL.md` 固化顶部状态切换胶囊栏 + 重置按钮 + 设备外壳 + 双向实时联动设计模式。
   - 严格遵循官方白名单 Tailwind、宿主 CSS 语义变量与内联/独立 Artifact 高度规范。

---

## 环境要求

- **操作系统**：Windows / macOS / Linux 全平台支持
- **运行时**：**Node.js >= 18**（且 `node` 命令位于系统 `PATH` 中）
  - 仓库已内置零依赖编译产物 `server/dist/server.mjs` 与单文件前端 `server/dist/ui/index.html`，**安装后无需执行 `npm install`**。
  - *macOS nvm 用户提示*：如果从桌面 GUI 应用启动时提示找不到 `node`，请为系统提供稳定的 `node` 路径（例如通过 Homebrew 安装或将当前 nvm 的 `node` 软链至 `/usr/local/bin/node`）。

---

## 安装方式

### 方式一：通过 GitHub 仓库一键安装（推荐）

```bash
agy plugin install https://github.com/yanliangyuYLY/visual-walkthrough
```

### 方式二：从本地目录安装

```bash
git clone https://github.com/yanliangyuYLY/visual-walkthrough.git
agy plugin install ./visual-walkthrough
```

### 方式三：团队项目内共享

将仓库内容放入业务项目的 `.agents/plugins/visual-walkthrough/`，团队成员拉取代码后即可自动加载使用。

---

## 合规性与安全设计

- **严格 CSP 零外链**：MCP App 前端使用 Vite + `vite-plugin-singlefile` 打包为单个自包含 HTML，零外部 CDN 脚本/样式，100% 满足 `default-src 'none'` 沙箱策略。
- **官方 SDK 与能力门控**：使用 `@modelcontextprotocol/ext-apps` 通信，先注册事件回调再 `connect()`；所有 `sendMessage` 按钮按 `app.getHostCapabilities()?.message` 门控，实时适配宿主深浅色主题变量。
- **主动触发与克制边界**：`rules/AGENTS.md`（纯 Markdown 无 frontmatter）指导 AI 在排查对照、复杂流程梳理和 UI 原型设计时主动可视化，日常简单问答保持克制。

---

## 本地开发与二次构建

如果你修改了 `server/src/` 或 `server/ui/` 源码，请重新构建并提交更新后的 `server/dist/`：

```bash
cd server
npm install
npm run typecheck
npm run build
```

构建后可使用官方 CLI 校验插件完整性：

```bash
agy plugin validate --strict .
```
