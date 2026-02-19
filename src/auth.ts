import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"

// 从第三方库引入登录、刷新 token、获取 API key 的工具，以及 OAuthCredentials 类型定义。
import {
  loginOpenAICodex,
  refreshOpenAICodexToken,
  openaiCodexOAuthProvider,
  type OAuthCredentials,
} from "@mariozechner/pi-ai"

// 定义认证目录和文件路径
const AUTH_DIR = join(homedir(), ".nano-clawd")
const AUTH_FILE = join(AUTH_DIR, "auth.json")

// 如果认证目录不存在，创建它
function ensureAuthDir(): void {
  if (!existsSync(AUTH_DIR)) {
    mkdirSync(AUTH_DIR, { recursive: true })
  }
}

// 保存认证凭证到文件
function saveCredentials(creds: OAuthCredentials): void {
  ensureAuthDir()
  writeFileSync(AUTH_FILE, JSON.stringify(creds, null, 2))
}


// 从文件加载认证凭证
function loadCredentials(): OAuthCredentials | null {
  if (!existsSync(AUTH_FILE)) return null
  try {
    return JSON.parse(readFileSync(AUTH_FILE, "utf-8"))
  } catch {
    return null
  }
}


// 登录 OpenAI Codex 并保存凭证
export async function login(): Promise<void> {
  const creds = await loginOpenAICodex({
    // 在执行了 login() 后触发 ，打印登录 URL 和提示信息
    onAuth: (info) => {
      console.log(`\nOpen this URL in your browser to log in:\n  ${info.url}`)
      if (info.instructions) console.log(`\n${info.instructions}`)
    },
    // 在用户使用浏览器完成了登录过程后触发，提示用户粘贴回浏览器的授权码
    onPrompt: async (prompt) => {
      // Simple stdin prompt fallback
      // 引入 readline 模块，用于从标准输入读取用户输入
      const { createInterface } = await import("readline")
      // 创建 readline 接口，用于从标准输入读取用户输入
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      return new Promise<string>((resolve) => {
        // 提示用户输入授权码
        rl.question(prompt.message + " ", (answer) => {
          rl.close()
          resolve(answer)
        })
      })
    },
    // 在登录过程中触发，打印进度信息
    onProgress: (msg) => {
      console.log(msg)
    },
  })
  // 调用 saveCredentials 函数，将获取到的凭证保存到文件
  saveCredentials(creds)
  // 打印登录成功的消息
  console.log("\nLogin successful! Credentials saved.")
}


export async function getApiKey(provider: string): Promise<string | undefined> {
  // 加载认证凭证，用之前定义的方法
  const creds = loadCredentials()
  if (!creds) throw new Error("Not logged in. Run: nano-clawd --login")

  // Check if token is expired (expires is in seconds)
  if (creds.expires * 1000 < Date.now()) {
    try {
      // 如果凭证过期，尝试刷新 token
      const refreshed = await refreshOpenAICodexToken(creds.refresh)
      // 刷新成功后，将新凭证保存到文件
      saveCredentials(refreshed)
      // 返回新的 API key
      return openaiCodexOAuthProvider.getApiKey(refreshed)
    } catch (err) {
      throw new Error("Token refresh failed. Please run: nano-clawd --login")
    }
  }

  return openaiCodexOAuthProvider.getApiKey(creds)
}
