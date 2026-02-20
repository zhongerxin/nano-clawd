#!/usr/bin/env node
// Initialize proxy before any network calls.
import { initProxy } from "./proxy.js";
initProxy();
import { main as runPiCodingAgent } from "@mariozechner/pi-coding-agent";
// Delegate full CLI/runtime behavior to pi-coding-agent.
runPiCodingAgent(process.argv.slice(2)).catch((err) => {
    console.error("Fatal error:", err?.message || String(err));
    process.exit(1);
});
//# sourceMappingURL=index_code.js.map