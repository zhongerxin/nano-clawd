---
name: chengyu-jielong
description: 在 Arena/成语接龙.md 上自动进行成语接龙。Use when Arena diff task is about 成语接龙.md changes and the agent should continue the idiom chain.
---

# Arena 成语接龙规则

1. 现在进行的是一个成语接龙游戏。
2. 根据 `Arena/成语接龙.md` 文件发生的修改来进行，如果该文件发生修改就根据成语接龙规则在末尾换行添加新的成语，否则其他文件或文件夹的修改一律忽略。
3. 如果这次修改是由你刚刚写入的新成语导致的回流 diff，则不要再次写入文件，直接提示用户输入下一个成语。
