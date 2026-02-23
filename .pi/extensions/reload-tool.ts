import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

export default function (pi: ExtensionAPI) {
  // 防止同一轮里被模型重复调用导致 followUp 连续入队
  let reloadQueued = false

  pi.registerCommand("reload-runtime", {
    description: "Reload extensions, skills, prompts, and themes",
    handler: async (_args, ctx) => {
      await ctx.reload()
      return
    },
  })

  pi.registerTool({
    name: "reload_runtime",
    label: "Reload Runtime",
    description: "Queue /reload-runtime once as follow-up",
    parameters: Type.Object({}),
    async execute() {
      if (reloadQueued) {
        return {
          content: [
            { type: "text", text: "Reload already queued in this turn, skipping duplicate." },
          ],
          details: { skipped: true, queued: false },
        }
      }

      reloadQueued = true
      pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" })

      return {
        content: [
          { type: "text", text: "Queued /reload-runtime as a follow-up command." },
        ],
        details: { skipped: false, queued: true },
      }
    },
  })
}
