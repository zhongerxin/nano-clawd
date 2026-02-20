import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

export default function reloadToolExtension(pi: ExtensionAPI) {
  // Optional custom slash command (manual trigger)
  pi.registerCommand("reload-runtime", {
    description: "Reload extensions, skills, prompts, and themes",
    handler: async (_args, ctx) => {
      await ctx.reload()
      return
    },
  })

  // LLM-callable tool
  pi.registerTool({
    name: "reload",
    label: "Reload Session",
    description: "Reload the current session runtime (extensions/skills/prompts/themes)",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      // In print/json mode, queued user messages may not behave as expected.
      if (!ctx.hasUI) {
        return {
          content: [{ type: "text", text: "当前为非交互模式，请手动执行 /reload。" }],
          details: { queued: false, reason: "no_ui" },
        }
      }

      // Use built-in /reload directly, and steer so it runs immediately after this tool.
      pi.sendUserMessage("/reload", { deliverAs: "steer" })

      return {
        content: [{ type: "text", text: "已在当前会话排队执行 /reload。" }],
        details: { queued: true, command: "/reload", deliverAs: "steer" },
      }
    },
  })
}
