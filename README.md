# dsh-weixin-clawbot

[![license](https://img.shields.io/badge/license-MIT-07C160?style=flat)](LICENSE) [![install](https://img.shields.io/badge/%E4%B8%80%E9%94%AE%E5%AE%89%E8%A3%85-dsh_plugin_add-111?style=flat)](#安装) [![channel](https://img.shields.io/badge/%E9%80%9A%E9%81%93-%E5%BE%AE%E4%BF%A1%E5%AE%98%E6%96%B9%E6%9C%BA%E5%99%A8%E4%BA%BA-4C8BF5?style=flat)](#ilink默认推荐)

**DeepSeek Harness（DSH）微信远程控制插件**：把微信变成 DSH agent 的远程终端。扫码绑定微信官方机器人后，你在微信里发消息就是给 agent 下指令——代码执行、工具调用、回复实时发回手机。

## 特性

- **微信官方机器人通道（默认）**：对接 iLink 机器人平台（与 `npx -y @tencent-weixin/openclaw-weixin-cli` 装出来的「微信 clawbot」同一后端协议），扫码 + 手机配对码绑定，不登录个人微信号、无网页协议风控
- **零配置一键安装**：声明 `dsh.bundle`，安装即自动激活，默认配置随包分发
- **Web 管理弹窗**：官方配对二维码（配对码输入）、解绑、回复颗粒度、工作区访问范围多选——界面与交互对齐 zcode Bot Channel 的微信管理页
- **入口状态角标**：侧边栏微信图标实时反映连接状态（🟢 已连接 / 🔴 连接失败）
- **工作区多选 + `/ws` 切换**：弹窗勾选可用工程，微信里 `/ws` 随时切，每个工作区独立会话历史
- **会话控制**：`/new`、`/stop`、`/status`、`/help`；群聊 @机器人触发
- **安全策略**：私聊 `open` / `pairing` / `allowlist` / `disabled`
- **备选后端**：wechaty 系（网页版 / 公众号 / 桔子云 / WeChatFerry）

## 安装

### 一键安装（GitHub）

```bash
# 已全局安装 dsh：
dsh plugin --profile web add github:xiixiixixi/dsh-weixin-clawbot

# 或用 npx（无需全局安装）：
npx -y @deepseek-ai/dsh plugin --profile web add github:xiixiixixi/dsh-weixin-clawbot
```

然后 `dsh web` 启动，就绪。**不需要手写任何配置**：

- 插件声明了 `dsh.bundle`，安装时自动加入 profile 组合层，默认配置随包分发（ilink 官方通道、`dmPolicy: open`）
- 仓库自带编译好的 `lib/`，无构建步骤、无 pnpm 放行

装好后：Web 端侧边栏微信图标 → 扫官方配对码 → 手机上出现数字 → 弹窗里输入 → 已连通。工作区在弹窗里勾选即可，不需要配置 `workspace`。

要覆盖默认值（收紧策略、限定白名单等）才写 profile 的 `cordis.patch.yml`（用户层叠加在插件自带层之上），示例见 [examples/cordis.patch.example.yml](examples/cordis.patch.example.yml)。

### 本地开发

```bash
dsh plugin --profile web add /path/to/dsh-weixin-clawbot   # link 安装，同样自动激活
```

改代码后 `npm run build` 即生效（link 方式直接用仓库的 `lib/`）。

## 配置

全部可选；以下为可覆盖项（默认值由随包分发的组合层提供）：

| 配置 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 是否启用 |
| `name` | string | `dsh-weixin-clawbot` | 实例名（日志标识） |
| `puppet` | string | `ilink` | `'ilink'`（官方机器人通道）或 wechaty puppet 包名（见下） |
| `puppetOptions` | object | `{}` | 后端参数；ilink 支持 `botAgent`（自声明 UA） |
| `workspace` | string | `process.cwd()` | 未勾选工作区时的 agent 工作目录（= dsh 启动目录）。通常留空，弹窗勾选工作区即可 |
| `model` | string | `''` | 模型 id；留空使用 DSH 默认模型选择 |
| `dmPolicy` | enum | `open` | 私聊策略：`open` / `pairing`（配对码）/ `allowlist` / `disabled` |
| `allowFrom` | array | `[]` | 私聊白名单（微信号 / 备注名 / `*`） |
| `groupPolicy` | enum | `allowlist` | 群策略：`open` / `allowlist` / `disabled` |
| `groups` | array | `[]` | 群白名单（群 id / 群名 / `*`） |
| `groupRequireMention` | boolean | `true` | 群内是否需要 @机器人（ilink 群消息本身就是 @触发，此项忽略） |
| `autoAcceptFriend` | boolean | `false` | 自动通过好友请求（仅 wechaty 后端） |
| `mediaMaxMb` / `mediaDir` | — | — | 入站媒体上限/目录（仅 wechaty 后端；ilink 媒体以摘要占位） |
| `noticeTools` | boolean | `true` | 工具调用提示（弹窗「颗粒度」可运行时覆盖） |
| `replyOn` | enum | `step` | `step` 每步即发 / `turn` 回合结束发；弹窗「颗粒度=摘要回复」等效 `turn` |
| `textChunkLimit` | number | `3800` | 单条微信消息文本上限 |

## 后端选择（puppet）

### ilink（默认，推荐）

对接**微信官方 iLink 机器人平台**（`https://ilinkai.weixin.qq.com`）——与腾讯官方 OpenClaw 微信插件（`@tencent-weixin/openclaw-weixin`，即「微信 clawbot」）相同的后端协议：

- `get_bot_qrcode` 出官方配对二维码 → 手机扫码 → 手机显示数字 → Web 弹窗输入配对码 → `bot_token` 落盘 `$DSH_HOME/dsh-weixin-clawbot-ilink.json`，重启免扫码
- `notifyStart` 握手 + `getupdates` 长轮询收消息（文本 + 语音转文字；图片/视频/文件摘要占位），`sendmessage` 发回复（携带 context_token）
- 会话失效（errcode -14）自动回到待扫码；解绑清凭据
- 账号安全：不登录个人微信号，而是给微信里的官方机器人发消息（clawbot 模式）

### wechaty 系（备选）

| puppet 包名 | 说明 | 成本 |
| --- | --- | --- |
| `wechaty-puppet-wechat` / `wechaty-puppet-wechat4u` | 网页版微信协议，扫码登录 | 免费（有风控风险，日志 1101 刷屏属会话失效） |
| `wechaty-puppet-official-account` | 微信公众号官方协议 | 免费（需服务号） |
| `@juzi/wechaty-puppet-service` | 桔子云 BOT 托管服务 | 商业 token |
| `wechaty-puppet-wcferry` | WeChatFerry（注入 Windows 桌面微信） | 免费（Windows 挂机） |

后三个是可选依赖：`npm i <包名>` 手动补齐。wechaty 后端默认 `WECHATY_LOG=error` 抑制 puppet 内部 WARN 刷屏（可环境变量覆盖）。二维码只在 Web 弹窗显示，不打印终端。

## 使用

### Web 端管理弹窗

侧边栏底部「微信」手机图标（设置旁边）打开「微信机器人」管理弹窗：

- **关联机器人**：官方配对二维码，扫码状态实时翻译成人话（等待扫码 / 已扫码请在手机确认 / 二维码已过期，不暴露状态码）；ilink 配对时手机显示一串数字，在弹窗输入框提交完成绑定；「无法扫码」可复制备用链接。凭据自动保存（重启免扫码），可随时**解绑**。关闭弹窗不会断开连接。
- **机器人回复颗粒度**：完整（每步 + 工具提示）/ 标准（每步文本）/ 摘要（仅回合结果），即时生效。
- **工作区访问范围**：多选 checkbox 列表。默认「所有工作区」不限制；勾选后每个微信主体默认在第一个勾选的工作区工作，微信里 `/ws` 随时切，每个工作区独立会话历史。

**入口状态角标**：🟢 已连接；🔴 连接失败（后端不可达/轮询错误，恢复后自动变绿）；等待态无角标。悬停显示具体状态。

弹窗里的颗粒度/工作区范围写入 `$DSH_HOME/dsh-weixin-clawbot.state.json`（原子写，重启保持）；`cordis.patch.yml` 里的 `replyOn`/`noticeTools` 是缺省基准值。无 workspaceRegistry 的 profile（headless）工作区列表为空，`/ws` 会提示去 Web 弹窗配置。

### 微信对话

| 命令 | 作用 |
| --- | --- |
| `/new` | 结束当前会话，下条消息开始全新会话 |
| `/stop` | 中止当前运行中的任务 |
| `/status` | 查看会话状态（含当前工作区） |
| `/ws` | 列出可用工作区；`/ws 2` 按序号、`/ws 名称` 按名称切换 |
| `/help` | 帮助 |

群聊需要 **@机器人** 才会响应（可配 `groupRequireMention: false` 关闭）。

**会话与重启**：同一次 dsh 运行内对话上下文连续；dsh 重启后微信会话自动开新篇（会话 id 带进程代次，避免与磁盘持久化日志冲突），历史对话仍持久化、可在 DSH Web UI 会话列表中查看。

## 实现原理

插件注入 DSH 核心服务（`agents`、`sessions`、`agentDefaultModel`，懒注入 `webServer`、`workspaceRegistry`、`agentPresets`），完全复用 DSH 的 agent 体系：

1. 入站微信消息按主体映射到稳定会话 id（`wechat:<kind>:<id>[#工作区][~进程代次]`），`agents.create()` 创建专属 agent 并 `followup()`；setup 内 `agentPresets.mount()` 装配标准工具组合（与 Web 端会话同构），创建后 `attachSession` 挂入勾选的工作区
2. 订阅 `session/event`，把 `assistant/message` 文本、`tool/call` 提示、`turn/end` 错误摘要发回微信
3. 模型/持久化/工具全部由 DSH 现有插件提供，微信只是另一块前端

## 排障

- 运行日志：dsh 启动终端或 `~/.dsh/dsh-web.log`，过滤 `[wechat]`（收消息 → 创建会话 → 已回复全链路可见）
- 消息无回应：先看入口角标颜色（红=后端不可达）；再看日志是否有 `getupdates 失败` / `errcode -14`（后者需重新扫码）
- 同一机器人只能有一个稳定消费者：若在 OpenClaw/ZCode 等处也绑过同一微信机器人，请停用它，避免抢消息

## 开发

```bash
npm install
npm run typecheck   # 对 dsh 包（rc.7）类型检查
npm test            # vitest：77 个用例
npm run build       # 编译 lib/（提交前构建，lib/ 随仓库分发）
```

冒烟验证（隔离 DSH_HOME + 真实 web profile）：

```bash
DSH_HOME=/tmp/clawbot-smoke npx -y @deepseek-ai/dsh plugin --profile web add github:xiixiixixi/dsh-weixin-clawbot
DSH_HOME=/tmp/clawbot-smoke npx -y @deepseek-ai/dsh --profile web --port 31789
```

## License

MIT
