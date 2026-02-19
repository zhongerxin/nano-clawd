import { spawn, type ChildProcess } from "child_process"
import { existsSync, readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core"
import { Type } from "@sinclair/typebox"

interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>
}

interface McpToolDef {
  name: string
  description?: string
  inputSchema?: any
}

class McpClient {
  private process: ChildProcess | null = null
  private requestId = 0
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>()
  private buffer = ""
  private serverName: string

  constructor(serverName: string) {
    this.serverName = serverName
  }

  async connect(command: string, args: string[], env?: Record<string, string>): Promise<void> {
    this.process = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...env },
    })

    this.process.stdout!.on("data", (data: Buffer) => {
      this.buffer += data.toString()
      this.processBuffer()
    })

    this.process.stderr!.on("data", (data: Buffer) => {
      // Log MCP server errors to stderr for debugging
      process.stderr.write(`[MCP:${this.serverName}] ${data.toString()}`)
    })

    this.process.on("exit", (code) => {
      for (const [, pending] of this.pending) {
        pending.reject(new Error(`MCP server ${this.serverName} exited with code ${code}`))
      }
      this.pending.clear()
    })
  }

  private processBuffer(): void {
    // JSON-RPC messages are separated by newlines
    const lines = this.buffer.split("\n")
    this.buffer = lines.pop() || ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
        this.handleMessage(msg)
      } catch {
        // Skip non-JSON lines
      }
    }
  }

  private handleMessage(msg: any): void {
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const pending = this.pending.get(msg.id)!
      this.pending.delete(msg.id)
      if (msg.error) {
        pending.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
      } else {
        pending.resolve(msg.result)
      }
    }
    // Ignore notifications for now
  }

  private send(method: string, params?: any): Promise<any> {
    const id = ++this.requestId
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params })

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.process!.stdin!.write(msg + "\n")
    })
  }

  async initialize(): Promise<void> {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "nano-clawd", version: "0.1.0" },
    })
    // Send initialized notification
    this.process!.stdin!.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
    )
  }

  async listTools(): Promise<McpToolDef[]> {
    const result = await this.send("tools/list")
    return result?.tools || []
  }

  async callTool(name: string, args: any): Promise<any> {
    return this.send("tools/call", { name, arguments: args })
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}

function loadMcpConfig(): McpConfig {
  const configPath = join(homedir(), ".nano-clawd", "mcp.json")
  if (!existsSync(configPath)) {
    return { mcpServers: {} }
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"))
  } catch {
    return { mcpServers: {} }
  }
}

// Keep track of clients for cleanup
const activeClients: McpClient[] = []

export async function loadMcpTools(): Promise<AgentTool<any>[]> {
  const config = loadMcpConfig()
  const tools: AgentTool<any>[] = []

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      const client = new McpClient(name)
      await client.connect(serverConfig.command, serverConfig.args || [], serverConfig.env)
      await client.initialize()
      const mcpTools = await client.listTools()
      activeClients.push(client)

      for (const t of mcpTools) {
        // Convert MCP JSON Schema to TypeBox-compatible schema
        const schema = t.inputSchema || Type.Object({})

        tools.push({
          name: `mcp_${name}_${t.name}`,
          label: `${name}:${t.name}`,
          description: t.description || `MCP tool ${t.name} from ${name}`,
          parameters: schema,
          execute: async (
            _toolCallId: string,
            params: any,
          ): Promise<AgentToolResult<any>> => {
            try {
              const result = await client.callTool(t.name, params)
              const text = typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2)
              return {
                content: [{ type: "text", text }],
                details: {},
              }
            } catch (err: any) {
              return {
                content: [{ type: "text", text: `MCP tool error: ${err.message}` }],
                details: { error: err.message },
              }
            }
          },
        })
      }
    } catch (err: any) {
      process.stderr.write(`[MCP] Failed to connect to ${name}: ${err.message}\n`)
    }
  }

  return tools
}

export async function closeMcpClients(): Promise<void> {
  for (const client of activeClients) {
    await client.close()
  }
  activeClients.length = 0
}
