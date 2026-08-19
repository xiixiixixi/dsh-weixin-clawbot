# dsh-weixin-clawbot 配对弹窗重构设计（对齐 zcode Bot Channel 微信管理页）

- 日期：2026-08-18
- 状态：已确认（用户于 2026-08-18 批准）

## 背景

dsh-weixin-clawbot 的扫码连接 UI 目前有三个问题：

1. 二维码曾直接打印在终端（工作区已删除 `qrcode-terminal`，扫码入口应完全转移到 web 端）。
2. web 端弹窗内容粗糙：硬编码颜色（`#666`/`#888`/`#eee`/橙色）、状态文案暴露 wechaty 内部状态码（「等待扫码登录（状态 2）」）、二维码裸 `<img>`、成功态用 emoji、自制 tooltip。
3. 功能缺失：没有解绑入口、没有回复颗粒度设置、没有工作区访问范围限制。

设计基准：zcode 桌面端 Bot Channel 的「微信机器人」管理页（见
<https://zcode.z.ai/cn/docs/bot-channel> 与 <https://zcode.z.ai/cn/docs/remote-control>），
以及用户提供的四张现状/参考截图。只做微信渠道，不做飞书/Lark/Telegram。

## 用户已确认的决策

| 决策点 | 结论 |
| --- | --- |
| 弹窗形态 | 紧凑单栏卡片（弹窗内可滚动） |
| 功能范围 | 连接 UI + 解绑 + 回复颗粒度 + 工作区访问范围 |
| 颜色基调 | 全部走 dsh `--dsw-alias-*` 令牌，深浅色自动适配 |

## 弹窗结构（单栏，自上而下）

```
[微信logo] 微信机器人                    ✕
在微信里远程操控 DSH agent。
● <状态行>                                  ← StateDot：运行中/等待扫码/已扫码/已连通/错误

关联机器人
扫码后自动保存凭据。
┌ 未连接：白框二维码 + 子状态文案 +
│  「无法扫码？在手机浏览器打开链接 [⧉ 复制]」
└ 已连接：[✓ 已连通] 账号名 · 微信ID  [解绑]
   ⓘ 请在微信里向 Bot 发送任意消息；首次消息会收到欢迎和帮助。

机器人回复颗粒度                    [标准 ▾]
消息详细程度。

工作区访问范围                      [所有工作区 ▾]
限制机器人可用的工作区。
（下拉：所有工作区 + workspaceRegistry 列表：title + path）
```

底部 caption 小字显示当前 puppet 后端名。

## 状态机与文案

| wechaty ScanStatus / 状态 | 徽章 | 文案 |
| --- | --- | --- |
| `none`（启动中） | StateDot `ongoing`（蓝色追逐） | 微信后端启动中… |
| scan / Waiting(2) | `ongoing` | 等待手机扫码 |
| scan / Scanned(3) | `ongoing` | 已扫码，请在手机上确认 |
| scan / Confirmed(4) | `ongoing` | 已确认，正在登录… |
| scan / Timeout(5) / Cancel(1) | `warning` | 二维码已过期，正在获取新码… |
| logged-in | `done`（绿） | 已连通：<账号名> |
| 轮询失败 | `error` | 连接中断，正在重试… |

不向用户暴露 wechaty 状态码数字。

## 交互语义（对齐 zcode）

1. **关闭弹窗 ≠ 断开**：微信登录保持；侧边栏图标绿角标表示已连通。
2. **解绑**：已连通态的 [解绑] 按钮 → `POST /wechat/logout` → `bot.logout()`，回到待扫码态（对应 zcode「已连通的机器人可随时解绑」）。
3. **复制链接**：复制 wechaty 备用链接 `https://wechaty.js.org/qrcode/<code>`，用 `writeClipboard` + 复制成功反馈；二维码过期自动刷新（wechaty 重新触发 scan），不提供手动刷新按钮。
4. **回复颗粒度**（下拉，即时生效并持久化）：
   - 完整 = `replyOn: 'step'` + `noticeTools: true`（每步文本 + 工具调用提示）
   - 标准 = `replyOn: 'step'` + `noticeTools: false`
   - 摘要 = `replyOn: 'turn'` + `noticeTools: false`（仅回合结束发结果）
5. **工作区访问范围**（下拉，即时生效并持久化）：
   - 所有工作区（默认）：新微信会话 agent cwd = 插件配置 `workspace`（现状行为）
   - 选定工作区：**新建**的微信 agent 会话 cwd = 该工作区 `path`；已有会话不受影响，`/new` 后按新范围生效

## host 端 API

| 路由 | 方法 | 说明 |
| --- | --- | --- |
| `/wechat/qrcode` | GET | 扩展载荷（见下） |
| `/wechat/settings` | POST | body `{ granularity?, workspaceScope? }`，校验 → 持久化 → 热应用；非法值 400 |
| `/wechat/logout` | POST | `bot.logout()` 解绑；未登录时幂等 200 |

`GET /wechat/qrcode` 载荷：

```ts
type WechatQrPayload = {
  ok: boolean
  state: WechatQrState            // 现有 none | scan | logged-in
  url?: string                    // scan 态备用链接
  user?: { id: string; name: string }
  puppet: string                  // 当前后端包名
  settings: {
    granularity: 'standard' | 'detailed' | 'summary'
    // 无 state 覆盖时从静态配置推导：replyOn:step+noticeTools:true→detailed、
    // step+false→standard、turn→summary，保证存量用户行为不变
    workspaceScope: 'all' | { workspaceId: string }    // 无覆盖时 'all'
  }
  workspaces: Array<{ id: string; title: string; path: string }>  // workspaceRegistry.list() 投影
}
```

## 持久化

运行时设置（颗粒度、工作区范围）写入 `$DSH_HOME/dsh-weixin-clawbot.state.json`
（原子写：临时文件 + rename）。读取失败回退默认值并在日志告警。
cordis.patch.yml 里的静态配置仍是基准值；state 文件是用户在弹窗里的运行时覆盖。

## 服务注入

- `webServer`：现有懒注入模式不变，三个路由都挂在其下。
- `workspaceRegistry`：新增 `ctx.inject(['workspaceRegistry'], …)` 懒注入（同 webServer 模式）；
  注册表不存在（headless profile）时 `workspaces: []`，下拉退化为只有「所有工作区」，微信功能不受影响。

## 工程方式

- **样式**：`src/client/wechat.css` 真样式表，esbuild `loader: { '.css': 'text' }` 打包，
  `apply()` 时注入 `<style data-plugin="dsh-weixin-clawbot">`（dsh 模块加载器官方支持，自动管理生命周期）。
  类名前缀 `dsh-weixin-clawbot-`，全部颜色/字体走 `--dsw-alias-*` 令牌。
  唯一硬编码色：微信品牌绿 logo（`#07C160`）与二维码白底（可扫性要求）。
- **组件复用**：`Modal`（弹窗 chrome）、`Menu`（两个下拉）、`StateDot`（状态点）、
  `writeClipboard`（复制）、`Tooltip`（侧边栏入口 hover）。
- **侧边栏入口**：手机图标描边风格、`label-secondary` 色（hover 变 primary），
  已连通时右下角 8px 绿角标；hover 显示 `Tooltip`（side=right，文案=状态行）。
- **轮询**：弹窗打开时 2s、关闭时 10s（现有节流保留）。

## 测试

- vitest 新增：`POST /wechat/settings` 校验与持久化（含非法值 400）、
  颗粒度↔replyOn/noticeTools 映射、工作区范围→agent cwd 语义、logout 路由、
  ScanStatus→文案映射（纯函数）。
- playwright 冒烟：隔离 DSH_HOME 起真实 web profile，截图核对
  待扫码/已连通（mock login）/设置更改/深浅色四组。

## 范围外

- 飞书 / Lark / Telegram 等其他 Bot Channel
- 删除机器人（卸载插件即等价操作）
- 聊天内 `/ws` 动态切换工作区（后续版本）
- 多语言（文案中文硬编码，与 README 定位一致）
