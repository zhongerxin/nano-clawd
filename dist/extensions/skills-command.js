import { resolve, sep } from "path";
function isPathInWorkspace(filePath, cwd) {
    if (!filePath)
        return false;
    const normalizedCwd = resolve(cwd);
    const normalizedPath = resolve(filePath);
    return normalizedPath === normalizedCwd || normalizedPath.startsWith(normalizedCwd + sep);
}
function formatSkillLine(skill) {
    const loc = skill.location ?? "unknown";
    const skillPath = skill.path ? ` - ${skill.path}` : "";
    return `- /${skill.name} (${loc})${skillPath}`;
}
export default function skillsCommandExtension(pi) {
    pi.registerCommand("skills", {
        description: "List skills available in current workspace",
        handler: async (_args, ctx) => {
            const allSkills = pi.getCommands().filter((cmd) => cmd.source === "skill");
            if (allSkills.length === 0) {
                pi.sendMessage({
                    customType: "skills",
                    content: "No skills are currently available.",
                    display: true,
                });
                return;
            }
            const workspaceSkills = allSkills.filter((skill) => skill.location === "project" || isPathInWorkspace(skill.path, ctx.cwd));
            const otherSkills = allSkills.filter((skill) => !workspaceSkills.includes(skill));
            const lines = [];
            lines.push(`Workspace: ${ctx.cwd}`);
            lines.push("");
            lines.push(`Workspace skills (${workspaceSkills.length})`);
            if (workspaceSkills.length === 0) {
                lines.push("- none");
            }
            else {
                for (const skill of workspaceSkills.sort((a, b) => a.name.localeCompare(b.name))) {
                    lines.push(formatSkillLine(skill));
                }
            }
            if (otherSkills.length > 0) {
                lines.push("");
                lines.push(`Other loaded skills (${otherSkills.length})`);
                for (const skill of otherSkills.sort((a, b) => a.name.localeCompare(b.name))) {
                    lines.push(formatSkillLine(skill));
                }
            }
            pi.sendMessage({
                customType: "skills",
                content: lines.join("\n"),
                display: true,
            });
        },
    });
}
//# sourceMappingURL=skills-command.js.map