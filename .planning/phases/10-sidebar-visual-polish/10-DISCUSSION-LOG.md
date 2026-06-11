# Phase 10: Sidebar Visual Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 10-Sidebar Visual Polish
**Areas discussed:** Row anatomy (name-crush fix), Active session distinction, 5-state status badge styling, Inactive List card structure + overall rhythm

---

## Row anatomy (name-crush fix)

### Q1 — 状态在展开行里怎么呈现？

| Option | Description | Selected |
|--------|-------------|----------|
| 双行：名字一行，状态小字副行（推荐） | 名字独占首行全宽；第二行小号 色点+状态词。DESIGN.md SessionCard 的 secondary-line 模式 | ✓ |
| 单行 + 只留色点（最紧凑） | 去掉状态文字，右端色点表状态；stopped/not_started 共用灰色，依赖颜色感知 | |
| 单行保留状态词，压缩其它 | 控制按钮 hover 才出现 + 状态词缩小；名字仍被截断（~12 字符） | |

**User's choice:** 双行：名字一行，状态小字副行
**Notes:** 用户通过 ASCII preview 确认了双行卡片形态。

### Q2 — 行上的控制按钮什么时候可见？

| Option | Description | Selected |
|--------|-------------|----------|
| hover / 键盘聚焦才出现（推荐） | 所有行（含 active）平时不显示；hover/focus-visible 浮现在行右端，不预留宽度 | ✓ |
| active 行常驻，其它行 hover（现状） | active 行控制钮一直可见；首行右端预留 ~50px | |
| 全部收进右键菜单 | 行上无控制按钮（Inactive Start ▶ 除外）；可发现性弱 | |

**User's choice:** hover / 键盘聚焦才出现
**Notes:** Inactive 行的 Start ▶ 明确不在本题范围（Phase 6.1 D-06 常驻决策保留）。

### Q3 — 副行除了状态词要不要显示 cwd？

| Option | Description | Selected |
|--------|-------------|----------|
| 状态 + cwd 尾段（推荐） | 「● Running · Marketing-p…」；cwd 取最后一段目录名，超长省略；无 cwd 只显示状态 | ✓ |
| 副行只放状态 | 最纯净；多项目同名工具场景只能靠名字/icon 区分 | |

**User's choice:** 状态 + cwd 尾段
**Notes:** 跨项目多 session 是核心使用场景，cwd 是身份强信号。

### Q4 — 双行布局下 session icon 怎么摆？

| Option | Description | Selected |
|--------|-------------|----------|
| 大 icon 跨两行（推荐） | ~32-36px 圆角砖垂直居中跨两行；行的视觉锚点；收起模式复用同一套样式 | ✓ |
| 小 icon 只在名字行 | 保持 ~20px 与名字同行；行更轻但锚点弱 | |

**User's choice:** 大 icon 跨两行

---

## Active session distinction

### Q1 — Active 行用什么处理手法？

| Option | Description | Selected |
|--------|-------------|----------|
| 填色卡片 + 左侧 accent 边条（推荐） | 白色填色卡片（边框+轻阴影抬升）+ 左缘 ~3-4px accent 竖条；双重信号 | ✓ |
| 填色卡片 + accent 描边 ring | 四周 ring 描边；与键盘 focus-ring 语义冲突风险 | |
| 只加重 tint 底色 + 字重 | 最克制；现状就是这个思路的失败样本 | |

**User's choice:** 填色卡片 + 左侧 accent 边条

### Q2 — Active accent 用固定品牌蓝还是跟随状态色？

| Option | Description | Selected |
|--------|-------------|----------|
| 跟随状态色（推荐） | running 蓝 / waiting 琥珀 / error 红 / finished 绿；复用 per-row inline --accent 机制 | ✓ |
| 固定品牌蓝 | 语义稳定但丢状态信息，且与 running 蓝点语义糊成一团 | |

**User's choice:** 跟随状态色

### Q3 — 收起 rail 模式下 active 怎么标？

| Option | Description | Selected |
|--------|-------------|----------|
| 同语言：填色砖 + rail 左缘边条（推荐） | 与展开模式同一套视觉语言；收起/展开切换视觉连贯 | ✓ |
| 只填色砖 + 状态色 ring | rail 更干净但与展开模式语言不连贯 | |

**User's choice:** 同语言：填色砖 + rail 左缘边条

---

## 5-state status badge styling

### Q1 — 副行里的状态用什么形态？

| Option | Description | Selected |
|--------|-------------|----------|
| 色点 + 状态词，无底色（推荐） | 轻文本「● Running · cwd」；calm low-contrast chrome | ✓ |
| tint 底 pill 小徽章 | chip 语言、状态更显眼；5+ session 时整栏变吵 | |

**User's choice:** 色点 + 状态词，无底色

### Q2 — 非 active session 翻到 waiting 时行上多响？

| Option | Description | Selected |
|--------|-------------|----------|
| 行级琥珀提醒：轻 wash + 边条（推荐） | 整行淡琥珀 tint + 左缘琥珀边条 + 「● Waiting for you」；静态不闪 | ✓ |
| 只换色点 + 文字（克制） | 最安静；一排蓝点里的小琥珀点易看漏 | |

**User's choice:** 行级琥珀提醒：轻 wash + 边条
**Notes:** 收起 rail 同语言 —— waiting 行同样吃左缘琥珀边条。

### Q3 — 收起 rail 上的状态点怎么画？

| Option | Description | Selected |
|--------|-------------|----------|
| 右下角加大 + 加厚描边（推荐） | 保持 NAV-01 已验证位置；点径 ~10px + 厚 surface 描边 | ✓ |
| icon 砖底色随状态 tint | 状态面积最大；会污染用户自选色块 icon | |

**User's choice:** 右下角加大 + 加厚描边

---

## Inactive List card structure + overall rhythm

### Q1 — Inactive List 的行用什么形态？

| Option | Description | Selected |
|--------|-------------|----------|
| 虚线 recipe 卡片（推荐） | 淡虚线边框卡片，与 + Add session 虚线同家族（虚线=蛋壳/配方）；保持双行 | ✓ |
| 同结构降饱和（dimmed 双胞胎） | 与 live 行同结构只降明度；两桶边界感弱 | |
| 紧凑单行 recipe | 单行高密度；丢副行信息，拖拽跨区视觉跳动 | |

**User's choice:** 虚线 recipe 卡片
**Notes:** 选中的 preview 副行显示 startup command（「npm run dev」）—— CONTEXT D-03 记录为：recipe 卡副行优先 startup command，退回 cwd。

### Q2 — 分区标签怎么处理？

| Option | Description | Selected |
|--------|-------------|----------|
| 小标签 + 数量（推荐） | 「WORKING AREA · 2」「INACTIVE · 3」+ --ink-faint + hairline 分隔 | ✓ |
| 纯标签不加数（现状精修） | 只调字号/字距/间距 | |
| 去掉标签，靠结构区分 | 最极简；新用户理解两桶语义门槛高 | |

**User's choice:** 小标签 + 数量

### Q3 — Inactive recipe 卡上常驻的 Start 按钮形态？

| Option | Description | Selected |
|--------|-------------|----------|
| 圆形 ghost ▶，hover 变 accent 实心（推荐） | 细边框圆形播放钮；安静且语义人人认识 | ✓ |
| 小 pill「▶ Start」文字钮 | 可发现性最强；多 recipe 时视觉重复感强 | |

**User's choice:** 圆形 ghost ▶，hover 变 accent 实心

---

## Claude's Discretion

- 行高/padding/gap 的具体数值（--space-* scale 落位）
- 边条宽度（3 vs 4px）、wash 浓度、点描边厚度、阴影档位 —— ui-lab 循环里对着 DESIGN-RUBRIC 调
- 拖拽柄在 hover-reveal 策略下的处理
- 名字/cwd 截断细节（ellipsis vs middle-truncate）
- 是否把 sidebar 样式从 terminal.css 抽成 sidebar.css（planner 定）
- 是否给 ui-lab 加 waiting/inactive 状态的新 capture surface

## Deferred Ideas

- 全局 hover/focus/active 一致性 + 完整 danger ramp 清查 → Phase 13（UI-06）
- 终端 pane 框感（Gap 2）→ Phase 11；Save 按钮 accent（Gap 3）→ Phase 12
- 空/加载/错误状态设计 → Phase 13（UI-05）
- 5 条 keyword-matched todos 已审阅未折入（SESS-05/06/07 → P11/12；DEBT-01/02 → P14）
