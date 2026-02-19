#!/usr/bin/env node
// 必须在最前面初始化代理，在任何 HTTP 请求之前
import { initProxy } from "./proxy.js";
initProxy();
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel, registerBuiltInApiProviders } from "@mariozechner/pi-ai";
import { login, getApiKey } from "./auth.js";
import { createTools } from "./tools.js";
import { loadMcpTools, closeMcpClients } from "./mcp.js";
import { buildSystemPrompt } from "./prompt.js";
import { createTui, waitForInput, handleAgentEvent, stopTui } from "./tui.js";
function parseArgs(argv) {
    // 解析 CLI 参数：把原始 argv 数组转换成结构化对象，便于后续使用。
    const args = {
        login: false,
        model: "openai-codex/gpt-5.2",
        workspace: process.cwd(),
    };
    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case "--login":
                // 开启登录流程，并在登录完成后退出程序。
                args.login = true;
                break;
            case "--model":
            case "-m":
                // 解析模型参数：允许 "provider/model" 或纯 "model"。
                // 注意 ++i 会把下一项当作参数值。
                args.model = argv[++i] || args.model;
                break;
            case "--workspace":
            case "-w":
                // 指定工作目录：影响工具的 cwd、系统提示词中的路径等。
                args.workspace = argv[++i] || args.workspace;
                break;
            case "--help":
            case "-h":
                // 输出帮助信息并立刻退出。
                console.log(`nano-clawd - Minimal AI Coding Agent

Usage: nano-clawd [options]

Options:
  --login          Login with OpenAI Codex OAuth
  --model, -m      Model to use (default: gpt-4.1)
  --workspace, -w  Working directory (default: current directory)
  --help, -h       Show this help message
`);
                process.exit(0);
        }
    }
    return args;
}
async function main() {
    // CLI 入口函数：串起登录、模型选择、工具加载、TUI 与主循环。
    const args = parseArgs(process.argv.slice(2));
    // Handle login flow
    if (args.login) {
        // 执行 OAuth 登录流程；完成后退出，避免进入交互主循环。
        await login();
        process.exit(0);
    }
    // Register built-in API providers
    // 必须先注册内置 provider，否则 getModel 可能找不到对应模型。
    registerBuiltInApiProviders();
    // Create tools
    const cwd = args.workspace;
    // 内置工具会使用工作目录作为执行根目录（影响文件读写、命令执行等）。
    const builtinTools = createTools(cwd);
    let mcpTools = [];
    try {
        // 加载 MCP 外部工具（可选），失败不阻断主流程。
        mcpTools = await loadMcpTools();
    }
    catch (err) {
        process.stderr.write(`Warning: Failed to load MCP tools: ${err.message}\n`);
    }
    const allTools = [...builtinTools, ...mcpTools];
    // Get model - support "provider/model" format
    let provider = "openai";
    let modelId = args.model;
    if (args.model.includes("/")) {
        // "provider/model" 形式：前半是 provider，后半是 modelId。
        const parts = args.model.split("/");
        provider = parts[0];
        modelId = parts.slice(1).join("/");
    }
    // 根据 provider + modelId 解析出具体模型对象。
    const model = getModel(provider, modelId);
    // Create agent
    const agent = new Agent({
        initialState: {
            // systemPrompt：定义 agent 的系统级行为和约束
            // tools：允许 agent 调用的工具集合
            systemPrompt: buildSystemPrompt(cwd),
            model,
            thinkingLevel: "medium",
            tools: allTools,
        },
        // agent 需要 API key 时会调用此回调获取。
        getApiKey,
    });
    // Create TUI
    // 初始化终端 UI，并得到上下文（渲染、输入、组件容器等）。
    const ctx = createTui();
    // Handle Ctrl+C (in raw mode, Ctrl+C becomes '\x03' character)
    process.stdin.on("data", (data) => {
        if (data.toString().includes("\x03")) {
            // raw 模式下，Ctrl+C 会变成字符 '\x03'，这里做优雅退出。
            stopTui(ctx);
            closeMcpClients().finally(() => process.exit(0));
        }
    });
    // Also handle SIGINT in case raw mode is disabled
    process.on("SIGINT", () => {
        // 非 raw 模式下的标准 SIGINT 信号处理。
        stopTui(ctx);
        closeMcpClients().finally(() => process.exit(0));
    });
    // Subscribe to agent events for rendering
    // 订阅 agent 事件：把流式回复、工具事件渲染到终端 UI。
    agent.subscribe((event) => handleAgentEvent(event, ctx));
    // Main loop
    try {
        while (true) {
            // 等待用户在 TUI 输入（可能是普通对话或命令）。
            const input = await waitForInput(ctx);
            if (input === "/quit" || input === "/exit") {
                // 用户主动退出命令。
                break;
            }
            if (input === "/clear") {
                // 清空对话历史和屏幕内容。
                agent.clearMessages();
                ctx.chatContainer.clear();
                ctx.tui.requestRender();
                continue;
            }
            // 把输入交给 agent 处理，并等待其进入 idle 状态。
            await agent.prompt(input);
            await agent.waitForIdle();
            // Manually stop loader after agent completes (in case events don't fire)
            // 保险：如果事件没触发，也手动停止加载动画并重绘。
            ctx.loader.stop();
            ctx.tui.requestRender();
        }
    }
    finally {
        // 无论如何都要清理 UI 和 MCP 客户端连接。
        stopTui(ctx);
        await closeMcpClients();
    }
}
// 启动 CLI，并在出现未捕获异常时输出错误并退出。
main().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
//# sourceMappingURL=index.js.map