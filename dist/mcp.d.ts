import type { AgentTool } from "@mariozechner/pi-agent-core";
export declare function loadMcpTools(): Promise<AgentTool<any>[]>;
export declare function closeMcpClients(): Promise<void>;
