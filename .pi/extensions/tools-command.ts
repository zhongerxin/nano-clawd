import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

function formatToolLine(name: string, description?: string): string {
  if (!description) return `- ${name}`
  return `- ${name}: ${description}`
}

export default function toolsCommandExtension(pi: ExtensionAPI) {
  pi.registerCommand("tools", {
    description: "List currently active tools",
    handler: async (_args, ctx) => {
      const allTools = pi.getAllTools()
      const activeNames = new Set(pi.getActiveTools())

      const activeTools = allTools
        .filter((tool) => activeNames.has(tool.name))
        .sort((a, b) => a.name.localeCompare(b.name))

      const lines: string[] = []
      lines.push("Tools (active)")
      lines.push("")

      if (activeTools.length === 0) {
        lines.push("- none")
      } else {
        for (const tool of activeTools) {
          lines.push(formatToolLine(tool.name))
        }
      }

      if (!ctx.hasUI) {
        console.log(lines.join("\n"))
        return
      }

      ctx.ui.setWidget("tools-list", lines, { placement: "aboveEditor" })
      ctx.ui.notify(`已列出 ${activeTools.length} 个可用 tools`, "info")
    },
  })
}
