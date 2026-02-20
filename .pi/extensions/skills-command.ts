import type { ExtensionAPI, SlashCommandInfo } from "@mariozechner/pi-coding-agent"
import { Container, Spacer, Text, matchesKey } from "@mariozechner/pi-tui"

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

/**
 * 将单个技能对象格式化为可展示的一行文本。
 *
 * 输出示例：
 * - /atlas (project) - /abs/path/to/SKILL.md
 *
 * 其中：
 * - `location` 为空时回退为 "unknown"
 * - `path` 为空时省略路径片段，避免出现多余符号
 */
function formatSkillLine(skill: SlashCommandInfo): string {
  // location 可能为空，使用空值合并给默认值，保证展示稳定
  const loc = skill.location ?? "unknown"
  // 统一展示格式，方便后续排序输出
  return `${skill.name} (${loc})`
}

/**
 * 扩展入口：注册 `/skills` 命令。
 *
 * 命令目标：
 * - 列出当前已加载的 skill 命令
 * - 按“工作区内 / 其他来源”分组显示
 * - 按名称排序，保证输出稳定、可读
 */
export default function skillsCommandExtension(pi: ExtensionAPI) {
  pi.registerCommand("skills", {
    description: "List skills available in current workspace",
    handler: async (_args, ctx) => {
      // 从所有命令中过滤出来源为 skill 的命令（排除普通内置命令）
      const allSkills = pi.getCommands().filter((cmd) => cmd.source === "skill")
      const sortedSkills = [...allSkills].sort((a, b) => a.name.localeCompare(b.name))

      // 使用 custom 弹出临时面板展示，按 Enter/Esc 关闭
      await ctx.ui.custom<void>(
        (_tui, theme, _keybindings, done) => {
          const container = new Container()

          container.addChild(new Text(theme.bold("Skills"), 1, 0))
          container.addChild(new Text(theme.fg("dim", `Workspace: ${ctx.cwd}`), 1, 0))
          container.addChild(new Spacer(1))
          container.addChild(new Text(theme.fg("dim", `Skills: ${allSkills.length}`), 1, 0))

          if (sortedSkills.length === 0) {
            container.addChild(new Text("- none", 1, 0))
          } else {
            for (const skill of sortedSkills) {
              // Spacer 是真正占行高的空白行，比传 "" 更稳定
              container.addChild(new Spacer(1))
              container.addChild(new Text(theme.bold(formatSkillLine(skill)), 1, 0))
              const description = truncateText(skill.description ?? "", 60).trim()
              if (description) {
                container.addChild(new Text(theme.fg("dim", description), 1, 0))
              }
            }
          }

          container.addChild(new Spacer(1))
          container.addChild(new Text(theme.fg("dim", "Press Enter or Esc to close"), 1, 0))

          return {
            render: (width: number) => container.render(width),
            invalidate: () => container.invalidate(),
            handleInput: (data: string) => {
              if (matchesKey(data, "enter") || matchesKey(data, "escape")) {
                done(undefined)
              }
            },
          }
        }
      )
    },
  })
}
