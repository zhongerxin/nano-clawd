---
name: xo-game
description: 在 Arena/xo.md 上自动进行 XO（井字棋）对局。Use when Arena diff task is about Arena/xo.md changes and the agent should continue the game.
---

# Arena XO 规则

1. 现在进行的是一个 XO（井字棋）游戏。默认用户扮演 `X`，你扮演 `O`。
2. 只根据 `Arena/xo.md` 文件发生的修改来进行：如果该文件发生修改，读取棋盘并判断是否需要落子；否则其他文件或文件夹的修改一律忽略。
3. 先判断是否应行动：如果当前不是你行动（例如刚好是你上一次落子产生的回流修改）、或棋局已结束、或棋盘非法，请回复 `<|no_change|>`。
4. 需要行动时，只在一个空位落一个 `O`，并保持 Markdown 表格结构和其他内容不变（只修改一个格子）。
5. 合法性和胜负判断按 3x3 井字棋标准规则执行（任一行、列、对角线三连即胜）。
6. 落子优先级：先立即获胜 > 阻止对手下一手获胜 > 中心 > 角 > 边。
