import { randomUUID } from "node:crypto"
import * as fs from "node:fs"
import { cp, mkdtemp, rm } from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent"
import { DEFAULT_MAX_LINES, truncateHead } from "@mariozechner/pi-coding-agent"

const WATCH_DIR = "Arena"
const DEBOUNCE_MS = 1200
const MAX_DIFF_BYTES = 40 * 1024

async function copySnapshot(fromDir: string, toDir: string) {
  await cp(fromDir, toDir, {
    recursive: true,
    force: true,
    errorOnExist: false,
    preserveTimestamps: false,
    filter: (src) => {
      const base = path.basename(src)
      return base !== ".DS_Store"
    },
  })
}

export default function arenaAutoDiffExtension(pi: ExtensionAPI) {
  let watcher: fs.FSWatcher | undefined
  let arenaDir = ""
  let tempRoot = ""
  let previousSnapshot = ""
  let debounceTimer: NodeJS.Timeout | undefined
  let processing = false
  let rerunRequested = false

  const queueReport = (ctx: ExtensionContext, report: string) => {
    // const header = [
    //   "Arena 目录发生变更。",
    //   "请你基于下面 diff，直接给我一份中文变化报告（重点改动、潜在风险、建议下一步）。",
    //   "",
    //   "```diff",
    //   report,
    //   "```",
    // ].join("\n")
    const header = [
      "Arena 目录发生了变更。",
      "请你基于下面 diff，和当前上下文的要求，判断下一步应该做什么；如果需要行动请直接执行。",
      "如果这次变更不需要你继续动作或者刚好是你上一次操作产生的变更，请回复：<|no_change|>。",
      "",
      "```diff",
      report,
      "```",
    ].join("\n")

    if (ctx.isIdle()) {
      pi.sendUserMessage(header)
      return
    }

    pi.sendUserMessage(header, { deliverAs: "followUp" })
  }

  const runDiffCheck = async (ctx: ExtensionContext) => {
    if (!arenaDir || !tempRoot || !previousSnapshot) return
    if (processing) {
      rerunRequested = true
      return
    }

    processing = true

    try {
      const nextSnapshot = path.join(tempRoot, randomUUID())
      await copySnapshot(arenaDir, nextSnapshot)

      const result = await pi.exec("diff", ["-ruN", previousSnapshot, nextSnapshot], { cwd: ctx.cwd })

      if (result.code === 0) {
        await rm(previousSnapshot, { recursive: true, force: true })
        previousSnapshot = nextSnapshot
        return
      }

      if (result.code > 1) {
        if (ctx.hasUI) ctx.ui.notify(`Arena diff 失败: ${result.stderr || "未知错误"}`, "error")
        await rm(nextSnapshot, { recursive: true, force: true })
        return
      }

      const normalized = (result.stdout || "")
        .replaceAll(previousSnapshot, WATCH_DIR)
        .replaceAll(nextSnapshot, WATCH_DIR)
        .trim()

      const truncation = truncateHead(normalized, {
        maxBytes: MAX_DIFF_BYTES,
        maxLines: DEFAULT_MAX_LINES,
      })

      let report = truncation.content
      if (truncation.truncated) {
        report += `\n\n[diff 已截断: ${truncation.outputLines}/${truncation.totalLines} 行]`
      }

      if (report) {
        queueReport(ctx, report)
      }

      await rm(previousSnapshot, { recursive: true, force: true })
      previousSnapshot = nextSnapshot
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (ctx.hasUI) ctx.ui.notify(`Arena watcher 异常: ${message}`, "error")
    } finally {
      processing = false
      if (rerunRequested) {
        rerunRequested = false
        void runDiffCheck(ctx)
      }
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    arenaDir = path.resolve(ctx.cwd, WATCH_DIR)

    try {
      const stat = await fs.promises.stat(arenaDir)
      if (!stat.isDirectory()) throw new Error(`${WATCH_DIR} 不是目录`)
    } catch {
      if (ctx.hasUI) ctx.ui.notify(`未找到 ${WATCH_DIR} 目录，arena-auto-diff 未启用`, "warning")
      return
    }

    tempRoot = await mkdtemp(path.join(os.tmpdir(), "pi-arena-watch-"))
    previousSnapshot = path.join(tempRoot, randomUUID())
    await copySnapshot(arenaDir, previousSnapshot)

    watcher = fs.watch(arenaDir, { recursive: true }, () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        void runDiffCheck(ctx)
      }, DEBOUNCE_MS)
    })

    watcher.on("error", (error) => {
      if (ctx.hasUI) ctx.ui.notify(`Arena watcher 监听失败: ${error.message}`, "error")
    })

    if (ctx.hasUI) {
      ctx.ui.notify(`已监听 ${WATCH_DIR} 目录变更`, "info")
    }
  })

  pi.on("session_shutdown", async () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    watcher?.close()
    watcher = undefined

    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true })
      tempRoot = ""
      previousSnapshot = ""
    }
  })
}
