import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Container, Text } from "@mariozechner/pi-tui"

type ChangeType = "modified" | "added" | "deleted" | "renamed"

interface FileChange {
  path: string
  type: ChangeType
  additions: number
  deletions: number
  contexts: string[]
}

function parseDiff(diff: string): FileChange[] {
  const files: FileChange[] = []
  const lines = diff.split("\n")
  let current: FileChange | undefined

  const pushCurrent = () => {
    if (current) files.push(current)
  }

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      pushCurrent()
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
      const path = match ? match[2] : "unknown"
      current = {
        path,
        type: "modified",
        additions: 0,
        deletions: 0,
        contexts: [],
      }
      continue
    }

    if (!current) continue

    if (line.startsWith("new file mode ")) {
      current.type = "added"
      continue
    }

    if (line.startsWith("deleted file mode ")) {
      current.type = "deleted"
      continue
    }

    if (line.startsWith("rename from ")) {
      current.type = "renamed"
      continue
    }

    if (line.startsWith("rename to ")) {
      current.path = line.replace("rename to ", "").trim()
      continue
    }

    if (line.startsWith("@@")) {
      const match = line.match(/@@.*@@\s?(.*)$/)
      const context = match?.[1]?.trim()
      if (context && !current.contexts.includes(context)) current.contexts.push(context)
      continue
    }

    if (line.startsWith("+++") || line.startsWith("---")) continue
    if (line.startsWith("+")) current.additions++
    if (line.startsWith("-")) current.deletions++
  }

  pushCurrent()
  return files
}

function summarizeDiff(diff: string): string {
  const files = parseDiff(diff)
  if (files.length === 0) return "当前没有检测到相对 HEAD 的代码变更。"

  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0)
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0)

  const typeText: Record<ChangeType, string> = {
    modified: "修改",
    added: "新增",
    deleted: "删除",
    renamed: "重命名",
  }

  const topFiles = files
    .slice()
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, 4)

  const fileSummaries = topFiles.map((file) => {
    const contextText = file.contexts.slice(0, 2).join("、")
    const contextSuffix = contextText ? `，主要涉及 ${contextText}` : ""
    return `${file.path}（${typeText[file.type]}，+${file.additions}/-${file.deletions}${contextSuffix}）`
  })

  return `本次变更共涉及 ${files.length} 个文件，累计新增 ${totalAdditions} 行、删除 ${totalDeletions} 行。重点改动包括：${fileSummaries.join("；")}。`
}

async function getDiff(pi: ExtensionAPI): Promise<string> {
  const inRepo = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"])
  if (inRepo.code !== 0) return ""

  const headCheck = await pi.exec("git", ["rev-parse", "--verify", "HEAD"])
  if (headCheck.code === 0) {
    const result = await pi.exec("git", ["diff", "--no-color", "--minimal", "HEAD"])
    return result.code === 0 ? result.stdout : ""
  }

  const staged = await pi.exec("git", ["diff", "--no-color", "--minimal", "--cached"])
  const unstaged = await pi.exec("git", ["diff", "--no-color", "--minimal"])
  return `${staged.stdout}\n${unstaged.stdout}`.trim()
}

export default function summarizeChangesExtension(pi: ExtensionAPI) {
  pi.registerCommand("summarize-changes", {
    description: "Summarize current git diff into a human-readable paragraph",
    handler: async (_args, ctx) => {
      const diff = await getDiff(pi)
      const summary = diff ? summarizeDiff(diff) : "当前目录不是 Git 仓库，或没有可读取的 diff。"

      if (!ctx.hasUI) {
        console.log(summary)
        return
      }

      ctx.ui.setWidget(
        "summarize-changes",
        (_tui, theme) => {
          const container = new Container()
          container.addChild(new Text(theme.bold("Change Summary"), 1, 0))
          container.addChild(new Text(theme.fg("dim", summary), 1, 0))
          return container
        },
        { placement: "aboveEditor" },
      )
      ctx.ui.notify("已生成变更摘要", "info")
    },
  })
}
