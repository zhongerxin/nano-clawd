import {
  AgentSession,
  InteractiveMode,
  type AgentSessionEvent,
  type AgentSessionEventListener,
  type ExtensionAPI,
} from "@mariozechner/pi-coding-agent"

const NO_CHANGE_TOKEN = "<|no_change|>"
const PATCHED_SUBSCRIBE_KEY = Symbol.for("nano-clawd.hide-no-change.subscribe.patched")
const PATCHED_RENDER_KEY = Symbol.for("nano-clawd.hide-no-change.render.patched")

function getAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") return ""
  const role = (message as { role?: unknown }).role
  if (role !== "assistant") return ""
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return ""

  const texts: string[] = []
  for (const part of content) {
    if (!part || typeof part !== "object") continue
    if ((part as { type?: unknown }).type !== "text") continue
    const text = (part as { text?: unknown }).text
    if (typeof text === "string") texts.push(text)
  }
  return texts.join("")
}

function isNoChangeAssistantMessage(message: unknown): boolean {
  return getAssistantText(message).trim() === NO_CHANGE_TOKEN
}

function isPotentialNoChangePrefix(message: unknown): boolean {
  const text = getAssistantText(message).trim()
  if (text.length === 0) return true
  return NO_CHANGE_TOKEN.startsWith(text)
}

function createFilteredListener(listener: AgentSessionEventListener): AgentSessionEventListener {
  let pendingStart: AgentSessionEvent | undefined
  let pendingUpdates: AgentSessionEvent[] = []
  let passthrough = false

  const clearPending = () => {
    pendingStart = undefined
    pendingUpdates = []
    passthrough = false
  }

  const flushPending = () => {
    if (!pendingStart) return
    listener(pendingStart)
    for (const bufferedUpdate of pendingUpdates) {
      listener(bufferedUpdate)
    }
  }

  return (event: AgentSessionEvent) => {
    if (event.type === "message_start" && event.message.role === "assistant") {
      pendingStart = event
      pendingUpdates = []
      passthrough = false
      return
    }

    if (!pendingStart) {
      listener(event)
      return
    }

    if (event.type === "message_update" && event.message.role === "assistant") {
      if (passthrough) {
        listener(event)
        return
      }

      pendingUpdates.push(event)
      if (!isPotentialNoChangePrefix(event.message)) {
        flushPending()
        pendingUpdates = []
        passthrough = true
      }
      return
    }

    if (event.type === "message_end" && event.message.role === "assistant") {
      if (isNoChangeAssistantMessage(event.message)) {
        clearPending()
        return
      }

      if (!passthrough) {
        flushPending()
      }
      listener(event)
      clearPending()
      return
    }

    listener(event)
  }
}

function patchAgentSessionSubscribe(): void {
  const proto = AgentSession.prototype as AgentSession & {
    [PATCHED_SUBSCRIBE_KEY]?: boolean
  }

  if (proto[PATCHED_SUBSCRIBE_KEY]) return

  const originalSubscribe = proto.subscribe
  proto.subscribe = function (listener: AgentSessionEventListener): () => void {
    return originalSubscribe.call(this, createFilteredListener(listener))
  }

  proto[PATCHED_SUBSCRIBE_KEY] = true
}

function patchInteractiveHistoryRender(): void {
  const proto = InteractiveMode.prototype as unknown as {
    [PATCHED_RENDER_KEY]?: boolean
    [key: string]: unknown
  }

  if (proto[PATCHED_RENDER_KEY]) return

  const originalAddMessageToChat = proto["addMessageToChat"]
  if (typeof originalAddMessageToChat !== "function") return

  proto["addMessageToChat"] = function (...args: unknown[]) {
    const [message] = args
    if (isNoChangeAssistantMessage(message)) {
      return
    }
    return (originalAddMessageToChat as (...inner: unknown[]) => unknown).apply(this, args)
  }

  proto[PATCHED_RENDER_KEY] = true
}

export default function hideNoChangeMessageExtension(_pi: ExtensionAPI) {
  patchAgentSessionSubscribe()
  patchInteractiveHistoryRender()
}
