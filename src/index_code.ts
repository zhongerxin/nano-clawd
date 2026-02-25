#!/usr/bin/env node

// Initialize proxy before any network calls.
import { initProxy } from "./proxy.js"
initProxy()

import { main as runPiCodingAgent } from "@mariozechner/pi-coding-agent"

function enableFetchVerboseIfNeeded() {
  if (process.env.NANO_CLAWD_FETCH_VERBOSE !== "1") return
  if (typeof globalThis.fetch !== "function") return

  const originalFetch = globalThis.fetch.bind(globalThis)
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const merged = { ...(init ?? {}), verbose: true } as RequestInit & { verbose?: boolean }
    return originalFetch(input, merged)
  }) as typeof fetch

  console.log("Fetch verbose: enabled")
}

// enableFetchVerboseIfNeeded()


// Delegate full CLI/runtime behavior to pi-coding-agent.
runPiCodingAgent(process.argv.slice(2)).catch((err: any) => {
  console.error("Fatal error:", err?.message || String(err))
  process.exit(1)
})


