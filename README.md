# Visual Walkthrough

作者：`a` · 版本：`2.0.0` · 协议：[MIT License](./LICENSE)

**Visual Walkthrough** 是一个符合 Google / Gemini Antigravity 官方插件架构与安全规范的跨平台混合一体插件，聚焦研发高频协作场景，在对话内联与侧栏工作台中提供三类高交互可视化内容：

1. **声明式研发交互卡片（MCP App — `render_ui_card`）**
   - **13 类研发积木**：基础 7 类（`table`、`callout`、`mermaid`、`steps`、`code`、`text`、`actions`）+ 研发 6 类（`tabs`、`metrics`、`diff`、`findings`、`plan`、`decision`）。
   - **双向协作批注与 Context Pill**：支持 `queue` 暂存按钮、条目级行内批注（`commentable`）与自由补充框（`allowCustomInput`）；用户交互后通过官方 `app.updateModelContext()` 实时同步至输入框 Context Pill，并支持底部汇总条一键 `app.sendMessage()` 发送并自动清空。
   - **800px 高度优化 & 本地计算**：`tabs` 分栏收纳避免内联截断；`decision` 维度权重滑块在前端零 LLM 调用实时重排；`<> Source` 随时查看/复制类 DSL 源码。

2. **可探索逻辑讲解卡片与侧栏工作台（MCP App — `render_logic_walkthrough` / `open_walkthrough_pane`）**
   - 内置可缩放（`-` / `100%` / `+`）、拖拽平移、源码切换、展开与 **`nodeDetails` 节点点击联动**的 Mermaid 流程图（点击节点展示详情、高亮定位对应步骤、侧栏 `toggle-aux-pane` 跳转源文件）。
   - 基于 `${PLUGIN_DATA}` 原子持久化最近 30 张历史卡片与草稿（通过 `visibility: ["app"]` 隐藏工具交互）；侧栏 `aux_pane` 工作台顶部内置**历史卡片切换**与 **4 套 Mini Gallery 组件示例**。

3. **可交互视觉原型（Skill + Generative UI）**
   - `skills/visual-prototype/SKILL.md` 固化顶部状态切换胶囊栏 + 重置按钮 + 设备外壳 + 双向实时联动设计模式。
   - 严格遵循官方白名单 Tailwind、宿主 CSS 语义变量、`<canvas>` 监听 `themechange` 与 450px 内联/独立 Artifact 高度规范。

---

## 环境要求

- **操作系统**：Windows / macOS / Linux 全平台支持
- **运行时**：**Node.js >= 18**（且 `node` 命令位于系统 `PATH` 中）
  - 仓库已内置零依赖自包含编译产物 `server/dist/server.mjs` 与单文件前端 `server/dist/ui/index.html`，**安装后无需执行 `npm install`**。
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

- **严格 CSP 零外链**：MCP App 前端使用 Vite + `vite-plugin-singlefile` 打包为单个自包含 HTML（零新增前端重型依赖，约 `5.4 MiB`，远低于 `10 MiB` 上限），100% 满足 `default-src 'none'` 沙箱策略。
- **最小权限模型**：MCP 服务端绝不充当任意本地文件读取代理，持久化仅限于 Antigravity 分配的 `${PLUGIN_DATA}` 目录，源文件打开统一由宿主 `com.google.antigravity/toggle-aux-pane` 受控完成。
- **官方 SDK 与能力门控**：使用 `@modelcontextprotocol/ext-apps` 通信，先注册事件回调再 `connect()`；按 `hostCapabilities` 严格门控 `message` / `updateModelContext` / `serverTools`；主题切换无损保留用户输入批注、队列与滑块权重状态；App-Only 工具严格标注 `visibility: ["app"]`。
- **递归体积预算与规则预算**：递归裁剪 `code`、`diff`、`findings.fix` 及 `tabs` 内嵌套块（750 KiB 安全线，低于 1 MiB 轨迹上限）；`rules/AGENTS.md`（纯 Markdown 无 frontmatter，`< 3 KB`）与 `skills/ui-card/references/` 遵循渐进式披露规范。

---

## 本地开发、测试与构建

如果你修改了 `server/src/` 或 `server/ui/` 源码，请运行测试并重新构建自包含产物 `server/dist/`：

```bash
cd server
npm install
npm run typecheck
npm test
npm run build
```

构建后可使用官方 CLI 校验插件完整性：

```bash
agy plugin validate --strict .
```
