import {
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent"
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core"
import { Type } from "@sinclair/typebox"

export function createTools(cwd: string): AgentTool<any>[] {
  // Built-in tools: read, bash, edit, write, grep, find, ls
  const tools: AgentTool<any>[] = [
    createReadTool(cwd),
    createBashTool(cwd),
    createEditTool(cwd),
    createWriteTool(cwd),
    createGrepTool(cwd),
    createFindTool(cwd),
    createLsTool(cwd),
  ]

  // WebFetch tool
  const webfetchTool: AgentTool<any> = {
    name: "webfetch",
    label: "WebFetch",
    description: "Fetch content from a URL and return as text. Use for reading web pages, APIs, or downloading text content.",
    parameters: Type.Object({
      url: Type.String({ description: "URL to fetch" }),
      maxLength: Type.Optional(Type.Number({ description: "Max response length in characters. Default: 50000" })),
    }),
    execute: async (
      _toolCallId: string,
      params: { url: string; maxLength?: number },
      signal?: AbortSignal,
    ): Promise<AgentToolResult<any>> => {
      try {
        const res = await fetch(params.url, { signal })
        let text = await res.text()
        const maxLen = params.maxLength ?? 50000
        if (text.length > maxLen) {
          text = text.slice(0, maxLen) + "\n...[truncated]"
        }
        return {
          content: [{ type: "text", text: `Status: ${res.status}\n\n${text}` }],
          details: { status: res.status },
        }
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error fetching ${params.url}: ${err.message}` }],
          details: { error: err.message },
        }
      }
    },
  }

  return [...tools, webfetchTool]
}
