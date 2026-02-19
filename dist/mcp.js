import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { Type } from "@sinclair/typebox";
class McpClient {
    process = null;
    requestId = 0;
    pending = new Map();
    buffer = "";
    serverName;
    constructor(serverName) {
        this.serverName = serverName;
    }
    async connect(command, args, env) {
        this.process = spawn(command, args, {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...env },
        });
        this.process.stdout.on("data", (data) => {
            this.buffer += data.toString();
            this.processBuffer();
        });
        this.process.stderr.on("data", (data) => {
            // Log MCP server errors to stderr for debugging
            process.stderr.write(`[MCP:${this.serverName}] ${data.toString()}`);
        });
        this.process.on("exit", (code) => {
            for (const [, pending] of this.pending) {
                pending.reject(new Error(`MCP server ${this.serverName} exited with code ${code}`));
            }
            this.pending.clear();
        });
    }
    processBuffer() {
        // JSON-RPC messages are separated by newlines
        const lines = this.buffer.split("\n");
        this.buffer = lines.pop() || "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed)
                continue;
            try {
                const msg = JSON.parse(trimmed);
                this.handleMessage(msg);
            }
            catch {
                // Skip non-JSON lines
            }
        }
    }
    handleMessage(msg) {
        if (msg.id !== undefined && this.pending.has(msg.id)) {
            const pending = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) {
                pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            }
            else {
                pending.resolve(msg.result);
            }
        }
        // Ignore notifications for now
    }
    send(method, params) {
        const id = ++this.requestId;
        const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.process.stdin.write(msg + "\n");
        });
    }
    async initialize() {
        await this.send("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "nano-clawd", version: "0.1.0" },
        });
        // Send initialized notification
        this.process.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    }
    async listTools() {
        const result = await this.send("tools/list");
        return result?.tools || [];
    }
    async callTool(name, args) {
        return this.send("tools/call", { name, arguments: args });
    }
    async close() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}
function loadMcpConfig() {
    const configPath = join(homedir(), ".nano-clawd", "mcp.json");
    if (!existsSync(configPath)) {
        return { mcpServers: {} };
    }
    try {
        return JSON.parse(readFileSync(configPath, "utf-8"));
    }
    catch {
        return { mcpServers: {} };
    }
}
// Keep track of clients for cleanup
const activeClients = [];
export async function loadMcpTools() {
    const config = loadMcpConfig();
    const tools = [];
    for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        try {
            const client = new McpClient(name);
            await client.connect(serverConfig.command, serverConfig.args || [], serverConfig.env);
            await client.initialize();
            const mcpTools = await client.listTools();
            activeClients.push(client);
            for (const t of mcpTools) {
                // Convert MCP JSON Schema to TypeBox-compatible schema
                const schema = t.inputSchema || Type.Object({});
                tools.push({
                    name: `mcp_${name}_${t.name}`,
                    label: `${name}:${t.name}`,
                    description: t.description || `MCP tool ${t.name} from ${name}`,
                    parameters: schema,
                    execute: async (_toolCallId, params) => {
                        try {
                            const result = await client.callTool(t.name, params);
                            const text = typeof result === "string"
                                ? result
                                : JSON.stringify(result, null, 2);
                            return {
                                content: [{ type: "text", text }],
                                details: {},
                            };
                        }
                        catch (err) {
                            return {
                                content: [{ type: "text", text: `MCP tool error: ${err.message}` }],
                                details: { error: err.message },
                            };
                        }
                    },
                });
            }
        }
        catch (err) {
            process.stderr.write(`[MCP] Failed to connect to ${name}: ${err.message}\n`);
        }
    }
    return tools;
}
export async function closeMcpClients() {
    for (const client of activeClients) {
        await client.close();
    }
    activeClients.length = 0;
}
//# sourceMappingURL=mcp.js.map