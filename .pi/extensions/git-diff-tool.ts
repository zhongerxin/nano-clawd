import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, truncateHead } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

const GitDiffParams = Type.Object({
  staged: Type.Optional(
    Type.Boolean({
      description: "If true, only show staged changes (git diff --cached).",
    }),
  ),
  path: Type.Optional(
    Type.String({
      description: "Optional file or directory path to limit diff scope.",
    }),
  ),
  contextLines: Type.Optional(
    Type.Integer({
      description: "Number of context lines around changes (0-20).",
      minimum: 0,
      maximum: 20,
    }),
  ),
  maxBytes: Type.Optional(
    Type.Integer({
      description: `Maximum diff bytes before truncation (default: ${DEFAULT_MAX_BYTES}).`,
      minimum: 1000,
      maximum: 200000,
    }),
  ),
})

interface GitDiffDetails {
  staged: boolean
  path?: string
  contextLines: number
  maxBytes: number
  truncated: boolean
  totalLines: number
  outputLines: number
  totalBytes: number
  outputBytes: number
}

function buildDiffArgs(contextLines: number, staged: boolean, path?: string): string[] {
  const args = ["diff", "--no-color", "--minimal", `--unified=${contextLines}`]
  if (staged) args.push("--cached")
  if (path) args.push("--", path)
  return args
}

export default function gitDiffToolExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "git_diff",
    label: "Git Diff",
    description:
      "Show current git diff for the current repository. Supports staged-only mode and optional path filtering.",
    parameters: GitDiffParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const staged = params.staged ?? false
      const path = params.path?.trim() || undefined
      const contextLines = params.contextLines ?? 3
      const maxBytes = params.maxBytes ?? DEFAULT_MAX_BYTES

      const inRepo = await pi.exec("git", ["rev-parse", "--is-inside-work-tree"], { cwd: ctx.cwd })
      if (inRepo.code !== 0) {
        return {
          content: [{ type: "text", text: "Current directory is not inside a Git repository." }],
          details: {
            staged,
            path,
            contextLines,
            maxBytes,
            truncated: false,
            totalLines: 0,
            outputLines: 0,
            totalBytes: 0,
            outputBytes: 0,
          } as GitDiffDetails,
        }
      }

      const headCheck = await pi.exec("git", ["rev-parse", "--verify", "HEAD"], { cwd: ctx.cwd })
      const hasHead = headCheck.code === 0

      let fullDiff = ""
      if (!hasHead && !staged) {
        const stagedResult = await pi.exec("git", buildDiffArgs(contextLines, true, path), { cwd: ctx.cwd })
        const unstagedResult = await pi.exec("git", buildDiffArgs(contextLines, false, path), { cwd: ctx.cwd })

        if (stagedResult.code !== 0 || unstagedResult.code !== 0) {
          const stderr = [stagedResult.stderr, unstagedResult.stderr].filter(Boolean).join("\n").trim()
          return {
            content: [{ type: "text", text: `Failed to read git diff.\n${stderr || "Unknown git error."}` }],
            details: {
              staged,
              path,
              contextLines,
              maxBytes,
              truncated: false,
              totalLines: 0,
              outputLines: 0,
              totalBytes: 0,
              outputBytes: 0,
            } as GitDiffDetails,
          }
        }

        fullDiff = [stagedResult.stdout, unstagedResult.stdout].filter(Boolean).join("\n").trim()
      } else {
        const args = ["diff", "--no-color", "--minimal", `--unified=${contextLines}`]
        if (staged) args.push("--cached")
        else if (hasHead) args.push("HEAD")
        if (path) args.push("--", path)

        const result = await pi.exec("git", args, { cwd: ctx.cwd })
        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Failed to read git diff.\n${result.stderr || "Unknown git error."}` }],
            details: {
              staged,
              path,
              contextLines,
              maxBytes,
              truncated: false,
              totalLines: 0,
              outputLines: 0,
              totalBytes: 0,
              outputBytes: 0,
            } as GitDiffDetails,
          }
        }

        fullDiff = result.stdout.trim()
      }

      if (!fullDiff) {
        return {
          content: [{ type: "text", text: "No changes found in the current diff scope." }],
          details: {
            staged,
            path,
            contextLines,
            maxBytes,
            truncated: false,
            totalLines: 0,
            outputLines: 0,
            totalBytes: 0,
            outputBytes: 0,
          } as GitDiffDetails,
        }
      }

      const truncation = truncateHead(fullDiff, {
        maxBytes,
        maxLines: DEFAULT_MAX_LINES,
      })

      let text = truncation.content
      if (truncation.truncated) {
        text += `\n\n[Diff truncated: ${truncation.outputLines}/${truncation.totalLines} lines, ${formatSize(
          truncation.outputBytes,
        )}/${formatSize(truncation.totalBytes)}]`
      }

      return {
        content: [{ type: "text", text }],
        details: {
          staged,
          path,
          contextLines,
          maxBytes,
          truncated: truncation.truncated,
          totalLines: truncation.totalLines,
          outputLines: truncation.outputLines,
          totalBytes: truncation.totalBytes,
          outputBytes: truncation.outputBytes,
        } as GitDiffDetails,
      }
    },
  })
}
