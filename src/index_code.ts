#!/usr/bin/env node

// Initialize proxy before any network calls.
import { initProxy } from "./proxy.js"
initProxy()

import { existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { main as runPiCodingAgent } from "@mariozechner/pi-coding-agent"


// 找到当前项目的 extensions 目录下的 skills-command.js 或 skills-command.ts 文件
function resolveBuiltInExtensionPath(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    join(here, "extensions", "skills-command.js"),
    join(here, "extensions", "skills-command.ts"),
  ]
  return candidates.find((p) => existsSync(p))
}

// 构建命令行参数，等价于在运行 ode dist/index.js 时 自动带上了 --extension <path>
function buildArgsWithExtensions(argv: string[]): string[] {
  const extensionPath = resolveBuiltInExtensionPath()
  if (!extensionPath) return argv
  return [...argv, "--extension", extensionPath]
}

// Delegate full CLI/runtime behavior to pi-coding-agent.
runPiCodingAgent(process.argv.slice(2)).catch((err: any) => {
  console.error("Fatal error:", err?.message || String(err))
  process.exit(1)
})

// runPiCodingAgent(buildArgsWithExtensions(process.argv.slice(2))).catch((err: any) => {
//   console.error("Fatal error:", err?.message || String(err))
//   process.exit(1)
// })

