import { createReadTool, createBashTool, createEditTool, createWriteTool, createGrepTool, createFindTool, createLsTool, } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
export function createTools(cwd) {
    // Built-in tools: read, bash, edit, write, grep, find, ls
    const tools = [
        createReadTool(cwd),
        createBashTool(cwd),
        createEditTool(cwd),
        createWriteTool(cwd),
        createGrepTool(cwd),
        createFindTool(cwd),
        createLsTool(cwd),
    ];
    // WebFetch tool
    const webfetchTool = {
        name: "webfetch",
        label: "WebFetch",
        description: "Fetch content from a URL and return as text. Use for reading web pages, APIs, or downloading text content.",
        parameters: Type.Object({
            url: Type.String({ description: "URL to fetch" }),
            maxLength: Type.Optional(Type.Number({ description: "Max response length in characters. Default: 50000" })),
        }),
        execute: async (_toolCallId, params, signal) => {
            try {
                const res = await fetch(params.url, { signal });
                let text = await res.text();
                const maxLen = params.maxLength ?? 50000;
                if (text.length > maxLen) {
                    text = text.slice(0, maxLen) + "\n...[truncated]";
                }
                return {
                    content: [{ type: "text", text: `Status: ${res.status}\n\n${text}` }],
                    details: { status: res.status },
                };
            }
            catch (err) {
                return {
                    content: [{ type: "text", text: `Error fetching ${params.url}: ${err.message}` }],
                    details: { error: err.message },
                };
            }
        },
    };
    return [...tools, webfetchTool];
}
//# sourceMappingURL=tools.js.map