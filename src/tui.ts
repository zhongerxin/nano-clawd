import {
  TUI,
  ProcessTerminal,
  Container,
  Editor,
  Markdown,
  Text,
  Loader,
  Spacer,
  type EditorTheme,
} from "@mariozechner/pi-tui"
import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core"
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai"
import {
  initTheme,
  getMarkdownTheme,
  getSelectListTheme,
} from "@mariozechner/pi-coding-agent"

// Simple ANSI color helpers
const ansi = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
}

export interface TuiContext {
  tui: TUI
  chatContainer: Container
  editor: Editor
  loader: Loader
  resolve: ((input: string) => void) | null
}

export function createTui(): TuiContext {
  // Initialize theme system from pi-coding-agent
  initTheme()

  const terminal = new ProcessTerminal()
  const tui = new TUI(terminal)

  // Header
  const header = new Text(
    ansi.cyan(" nano-clawd") + ansi.dim(" — AI Coding Agent"),
    1,
    0,
  )

  const separator = new Text(ansi.dim("─".repeat(80)), 0, 0)

  // Chat area
  const chatContainer = new Container()

  // Loader (shown during streaming)
  const loader = new Loader(tui, ansi.cyan, ansi.dim)

  // Editor - construct EditorTheme from available APIs
  const selectListTheme = getSelectListTheme()
  const editorTheme: EditorTheme = {
    borderColor: ansi.cyan,
    selectList: selectListTheme,
  }
  const editor = new Editor(tui, editorTheme, { paddingX: 1 })

  tui.addChild(header)
  tui.addChild(separator)
  tui.addChild(chatContainer)
  tui.addChild(loader)
  tui.addChild(editor)
  tui.setFocus(editor)
  tui.start()

  const ctx: TuiContext = {
    tui,
    chatContainer,
    editor,
    loader,
    resolve: null,
  }

  return ctx
}

export function waitForInput(ctx: TuiContext): Promise<string> {
  return new Promise<string>((resolve) => {
    ctx.resolve = resolve
    ctx.editor.onSubmit = (text: string) => {
      if (text.trim()) {
        ctx.editor.setText("")
        ctx.editor.addToHistory(text)
        ctx.resolve = null
        ctx.editor.onSubmit = undefined
        resolve(text.trim())
      }
    }
  })
}

function getAssistantText(message: AgentMessage): string {
  const msg = message as AssistantMessage
  if (!msg.content) return ""
  return msg.content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("")
}

export function handleAgentEvent(event: AgentEvent, ctx: TuiContext): void {
  const mdTheme = getMarkdownTheme()

  switch (event.type) {
    case "agent_start": {
      ctx.loader.start()
      ctx.loader.setMessage("Thinking...")
      ctx.tui.requestRender()
      break
    }

    case "message_start": {
      // Add user message display
      const msg = event.message as any
      if (msg.role === "user" && typeof msg.content === "string") {
        const userText = new Text(
          ansi.cyan("You: ") + msg.content,
          1,
          0,
        )
        ctx.chatContainer.addChild(userText)
        ctx.chatContainer.addChild(new Spacer(1))
        ctx.tui.requestRender()
      }
      break
    }

    case "message_update": {
      const text = getAssistantText(event.message)
      if (!text) break

      // Find or create markdown component for current assistant message
      const children = ctx.chatContainer.children
      const lastChild = children[children.length - 1]

      if (lastChild && (lastChild as any).__isAssistantMd) {
        ;(lastChild as Markdown).setText(text)
      } else {
        const md = new Markdown(text, 1, 0, mdTheme)
        ;(md as any).__isAssistantMd = true
        ctx.chatContainer.addChild(md)
      }

      ctx.loader.setMessage("Generating...")
      ctx.tui.requestRender()
      break
    }

    case "message_end": {
      const msg = event.message as AssistantMessage
      if (msg.role === "assistant") {
        ctx.chatContainer.addChild(new Spacer(1))
        // Stop loader when assistant message ends
        ctx.loader.stop()
        ctx.tui.requestRender()
      }
      break
    }

    case "tool_execution_start": {
      const toolLabel = new Text(
        ansi.yellow(`  [${event.toolName}] `) +
          ansi.dim(truncateArgs(event.args)),
        0,
        0,
      )
      ctx.chatContainer.addChild(toolLabel)
      ctx.loader.setMessage(`Running ${event.toolName}...`)
      ctx.tui.requestRender()
      break
    }

    case "tool_execution_end": {
      const resultText = extractToolResultText(event.result)
      if (resultText) {
        const truncated = resultText.length > 500
          ? resultText.slice(0, 500) + "\n...[truncated]"
          : resultText
        const output = new Text(ansi.gray(truncated), 2, 0)
        ctx.chatContainer.addChild(output)
      }
      ctx.tui.requestRender()
      break
    }

    case "turn_end": {
      // 每个 turn 结束后停止 loader
      ctx.loader.stop()
      ctx.tui.requestRender()
      break
    }

    case "agent_end": {
      ctx.loader.stop()
      ctx.tui.requestRender()
      break
    }
  }
}

function truncateArgs(args: any): string {
  const str = JSON.stringify(args)
  return str.length > 100 ? str.slice(0, 100) + "..." : str
}

function extractToolResultText(result: any): string {
  if (!result) return ""
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
  }
  if (typeof result === "string") return result
  return JSON.stringify(result)
}

export function stopTui(ctx: TuiContext): void {
  ctx.loader.stop()
  ctx.tui.stop()
}
