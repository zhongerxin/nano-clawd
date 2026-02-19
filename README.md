# nano-clawd

一个最小化的终端 AI 编程助手，基于 [pi-mono](https://github.com/badlogic/pi-mono) 生态构建。

nano-clawd 可以在终端中与你对话，读写文件、执行命令、搜索代码，并支持通过 MCP 协议扩展额外工具。

## 功能

- **AI 对话** — 基于 OpenAI 模型（默认 gpt-4.1）的流式对话，支持 Markdown 渲染
- **内置工具** — 7 个编程工具：read、bash、edit、write、grep、find、ls
- **WebFetch** — 抓取网页内容
- **MCP 扩展** — 通过 MCP stdio 协议连接外部工具服务器，动态发现和调用工具
- **Skills 系统** — 支持加载自定义 Skill 文件来增强系统提示词
- **OAuth 登录** — 使用 OpenAI Codex OAuth 进行认证，自动刷新过期 token
- **终端 UI** — 彩色 Markdown 渲染、流式输出、多行编辑器、加载动画

## 项目结构

```
nano-clawd/
├── package.json          # 依赖和脚本
├── tsconfig.json         # TypeScript 配置
├── README.md             # 本文件
└── src/
    ├── index.ts          # 自定义主入口：CLI 参数解析、Agent 创建、主循环
    ├── index_code.ts     # 简化入口：直接调用 pi-coding-agent runtime
    ├── auth.ts           # OpenAI Codex OAuth 登录和 token 管理
    ├── tools.ts          # 工具注册：7 个内置工具 + WebFetch
    ├── mcp.ts            # MCP stdio 客户端：连接服务器、发现和调用工具
    ├── prompt.ts         # 系统提示词模板 + Skills 加载
    └── tui.ts            # 终端 UI：布局、渲染、输入处理
```

### 各文件说明

| 文件 | 职责 |
|------|------|
| `index.ts` | 程序入口。解析 `--login`/`--model`/`--workspace` 等 CLI 参数，依次初始化认证、工具、MCP、提示词、Agent 和 TUI，然后运行主循环：等待用户输入 → 发送给 Agent → 渲染响应。 |
| `index_code.ts` | 直接把 CLI 参数透传给 `@mariozechner/pi-coding-agent` 的 `main()`，使用其内置 runtime（会话、持久化、压缩、交互模式等）。 |
| `auth.ts` | 调用 pi-ai 的 `loginOpenAICodex()` 进行设备码 OAuth 登录，将凭证保存到 `~/.nano-clawd/auth.json`，过期时自动调用 `refreshOpenAICodexToken()` 刷新。 |
| `tools.ts` | 通过 `createReadTool()`、`createBashTool()` 等函数创建 7 个内置工具，另外创建一个 `webfetch` 工具用于抓取网页，最终返回合并后的工具数组。 |
| `mcp.ts` | 读取 `~/.nano-clawd/mcp.json` 配置，为每个 MCP 服务器启动子进程，通过 JSON-RPC 2.0 协议执行 `initialize` → `tools/list` → `tools/call`，将发现的工具转换为 Agent 可用的格式。 |
| `prompt.ts` | 构建系统提示词，包含工作目录、平台信息、工具说明，并从 `~/.nano-clawd/skills/` 目录加载 Skill 文件合并到提示词中。 |
| `tui.ts` | 使用 pi-tui 组件构建终端界面（Header、聊天区、加载动画、编辑器），监听 Agent 事件进行流式渲染，显示工具调用过程和结果。 |

### 依赖的 pi-mono 包

| 包 | 用途 |
|----|------|
| `@mariozechner/pi-ai` | LLM 多 provider 抽象、模型管理、OpenAI Codex OAuth |
| `@mariozechner/pi-agent-core` | Agent 运行时（消息循环、工具调用、事件系统） |
| `@mariozechner/pi-tui` | 终端 UI 组件（Editor、Markdown、Loader 等） |
| `@mariozechner/pi-coding-agent` | 内置编程工具（bash/read/write/edit/grep/find/ls）和 Skills 系统 |

## 快速开始

### 环境要求

- Node.js >= 20
- npm
- （可选）[Bun](https://bun.sh/) 用于开发模式

### 第一步：安装依赖

```bash
cd nano-clawd
npm install
```

### 第二步：编译项目

```bash
npm run build
```

编译产物输出到 `dist/` 目录。

### 第三步：登录 OpenAI

首次使用前需要通过 OAuth 登录获取 token：

```bash
node dist/index.js --login
```

程序会输出一个 URL，在浏览器中打开并完成登录。登录成功后凭证保存在 `~/.nano-clawd/auth.json`。

### 第四步：启动使用

```bash
node dist/index.js
```

启动后进入终端 UI，在底部编辑器输入消息，按 Enter 发送。

### （可选）使用 pi-coding-agent runtime 入口

如果你想直接体验 `@mariozechner/pi-coding-agent` 的原生 runtime（会话持久化、自动压缩、完整命令体系），可以使用：

```bash
node dist/index_code.js
```

查看该入口支持的全部参数：

```bash
node dist/index_code.js --help
```

#### 使用 Bun 直接运行（免 build）

开发阶段如果不想每次改完都 `npm run build`，可以直接运行 TypeScript 源码：

```bash
# 自定义入口（src/index.ts）
bun run src/index.ts

# pi-coding-agent runtime 入口（src/index_code.ts）
bun run src/index_code.ts
```

查看 `index_code.ts` 的参数帮助：

```bash
bun run src/index_code.ts --help
```

说明：

- 以上是开发态运行方式，改完源码可直接生效。
- 需要发布/分发，或按 README 中 `node dist/...` 方式运行时，仍需要先执行 `npm run build`。

#### 开发模式（使用 Bun）

```bash
npm run dev
# 等价于: bun run src/index.ts
```

### CLI 参数

以下参数是 `index.ts`（自定义入口）支持的参数：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--login` | 执行 OAuth 登录流程 | — |
| `--model`, `-m` | 指定模型 | `gpt-4.1` |
| `--workspace`, `-w` | 指定工作目录 | 当前目录 |
| `--help`, `-h` | 显示帮助信息 | — |

#### 示例

```bash
# 使用不同模型
node dist/index.js -m gpt-4o

# 指定工作目录
node dist/index.js -w /path/to/your/project
```

## 内置命令

在对话中可以使用以下命令：

| 命令 | 说明 |
|------|------|
| `/quit` 或 `/exit` | 退出程序 |
| `/clear` | 清空对话历史 |

## 测试验证

以下是逐步测试各项功能的方法：

### 1. 测试登录

```bash
node dist/index.js --login
```

预期结果：输出一个 URL，在浏览器中完成登录后，终端显示 "Login successful!"，并在 `~/.nano-clawd/auth.json` 生成凭证文件。

### 2. 测试基本对话

启动程序后，输入一段简单文本：

```
你好，请介绍一下你自己
```

预期结果：AI 以流式方式返回响应，文本通过 Markdown 渲染显示在聊天区域。

### 3. 测试工具调用

输入触发工具使用的指令：

```
列出当前目录下的文件
```

预期结果：Agent 调用 `bash` 或 `ls` 工具，界面显示工具名称、参数和执行结果。

### 4. 测试文件读写

```
读取 package.json 的内容
```

预期结果：调用 `read` 工具，显示 package.json 的文件内容。

### 5. 测试 WebFetch

```
抓取 https://example.com 的网页内容
```

预期结果：调用 `webfetch` 工具，返回网页的 HTTP 状态码和文本内容。

### 6. 测试 MCP 工具（可选）

创建 MCP 配置文件 `~/.nano-clawd/mcp.json`：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

然后重新启动程序。预期结果：启动时自动连接 MCP 服务器并注册额外工具，工具名称格式为 `mcp_filesystem_*`。

### 7. 测试 Skills（可选）

创建一个 Skill 文件：

```bash
mkdir -p ~/.nano-clawd/skills
cat > ~/.nano-clawd/skills/code-review.md << 'EOF'
---
name: code-review
description: Review code for best practices
---

When reviewing code, check for:
- Security vulnerabilities
- Performance issues
- Code style consistency
EOF
```

重新启动程序后，Skill 的内容会被加入系统提示词，影响 AI 的行为。

### 8. 测试清空和退出

```
/clear
```

预期结果：聊天区域清空，对话历史重置。

```
/quit
```

预期结果：程序正常退出，MCP 客户端连接关闭。

## 架构流程

```
用户输入 (TUI Editor)
    |
    v
index.ts (主循环)
    |-- auth.ts   --> OAuth 登录 / token 管理
    |-- tools.ts  --> 7 个内置工具 + WebFetch
    |-- mcp.ts    --> MCP 服务器 --> 动态工具
    |-- prompt.ts --> 系统提示词 + Skills
    +-- tui.ts    --> 终端 UI 渲染
         |
         v
Agent (pi-agent-core)
         |
         v
pi-ai --> OpenAI API (Bearer token)
```

## 配置文件

| 路径 | 说明 |
|------|------|
| `~/.nano-clawd/auth.json` | OAuth 凭证（自动生成） |
| `~/.nano-clawd/mcp.json` | MCP 服务器配置（手动创建） |
| `~/.nano-clawd/skills/*.md` | 自定义 Skill 文件（手动创建） |

## 许可证

MIT
