import { TUI, Container, Editor, Loader } from "@mariozechner/pi-tui";
import type { AgentEvent } from "@mariozechner/pi-agent-core";
export interface TuiContext {
    tui: TUI;
    chatContainer: Container;
    editor: Editor;
    loader: Loader;
    resolve: ((input: string) => void) | null;
}
export declare function createTui(): TuiContext;
export declare function waitForInput(ctx: TuiContext): Promise<string>;
export declare function handleAgentEvent(event: AgentEvent, ctx: TuiContext): void;
export declare function stopTui(ctx: TuiContext): void;
