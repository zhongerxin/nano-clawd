import { loadSkills, formatSkillsForPrompt } from "@mariozechner/pi-coding-agent"
import { homedir } from "os"
import { join } from "path"

export function buildSystemPrompt(cwd: string): string {
  // Load skills from default locations + nano-clawd skills directory
  const skillsDir = join(homedir(), ".nano-clawd", "skills")
  const { skills } = loadSkills({
    cwd,
    skillPaths: [skillsDir],
    includeDefaults: true,
  })
  const skillsSection = skills.length > 0 ? "\n" + formatSkillsForPrompt(skills) : ""

  return `You are nano-clawd, a minimal AI coding assistant running in the terminal.

Working directory: ${cwd}
Platform: ${process.platform}
Date: ${new Date().toISOString().split("T")[0]}

You have access to these tools:
- read: Read file contents
- bash: Execute shell commands
- edit: Edit files with search/replace
- write: Create or overwrite files
- grep: Search file contents with regex
- find: Find files by glob pattern
- ls: List directory contents
- webfetch: Fetch content from URLs

Use tools when actions are needed. Keep responses concise and focused.
When editing code, read the file first to understand its structure.
${skillsSection}`
}
