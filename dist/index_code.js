#!/usr/bin/env node
// Initialize proxy before any network calls.
import { initProxy } from "./proxy.js";
initProxy();
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { main as runPiCodingAgent } from "@mariozechner/pi-coding-agent";
function resolveBuiltInExtensionPath() {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
        join(here, "extensions", "skills-command.js"),
        join(here, "extensions", "skills-command.ts"),
    ];
    return candidates.find((p) => existsSync(p));
}
function buildArgsWithExtensions(argv) {
    const extensionPath = resolveBuiltInExtensionPath();
    if (!extensionPath)
        return argv;
    return [...argv, "--extension", extensionPath];
}
// Delegate full CLI/runtime behavior to pi-coding-agent.
runPiCodingAgent(buildArgsWithExtensions(process.argv.slice(2))).catch((err) => {
    console.error("Fatal error:", err?.message || String(err));
    process.exit(1);
});
//# sourceMappingURL=index_code.js.map