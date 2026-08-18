# dsh-wechat

**DeepSeek Harness 微信远程控制插件**：把微信变成 DSH 的远程终端。扫码连接后，你用微信给机器人发消息，消息进入一个专属的 DSH agent 会话；agent 的回复、工具调用提示和错误摘要会实时发回你的微信。

- **官方机器人通道（推荐，默认）**：`puppet: ilink`——对接微信官方 iLink 机器人平台（与 `npx -y @tencent-weixin/openclaw-weixin-cli install` 装出来的微信 clawbot 同一后端协议），扫码授权 + 手机配对码绑定，账号安全
- 私聊即对话：每个微信用户拥有独立、持续的 agent 会话
- 群聊支持：@机器人触发，群白名单/开放策略
- 安全：私聊支持 `open` / `pairing`（配对码）/ `allowlist` / `disabled` 四种策略
- 控制命令：`/new`、`/stop`、`/status`、`/ws`（切换工作区）、`/help`
- 多后端：iLink 官方机器人 / 网页版微信 / 微信公众号 / 桔子云 BOT / WeChatFerry

## 安装

插件是一个普通 Cordis 插件包。先装进 DSH profile，再把它插进组合：

```bash
# 1. 安装包（本地路径或 npm 包名）
dsh plugin --profile web add /path/to/dsh-wechat

# 2. 编辑 $DSH_HOME/profiles/web/cordis.patch.yml，插入插件条目：
cat >> $DSH_HOME/profiles/web/cordis.patch.yml <<'EOF'
- insert:
    - id: wechat
      name: dsh-wechat
      config:
        puppet: ilink
        # 微信 agent 的默认工作目录（建议显式配置成你的工程主文件夹）
        workspace: /path/to/your/project
        dmPolicy: open
        groupPolicy: allowlist
        groups: []
EOF
```

> `cordis.patch.yml` 是 profile 的用户补丁层，`insert:` 把新条目追加进组合树。

## 配置

| 配置 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 是否启用 |
| `name` | string | `dsh-wechat` | 实例名（日志标识） |
| `puppet` | string | `ilink` | `'ilink'`（官方机器人通道）或 wechaty puppet 包名（见下） |
| `puppetOptions` | object | `{}` | 后端参数；ilink 支持 `botAgent`（自声明 UA） |
| `workspace` | string | `process.cwd()` | agent 的默认工作目录（未配置时 = dsh 启动时所在目录）。勾选工作区或 `/ws` 切换后按工作区路径工作；建议显式配置成你的工程主文件夹 |
| `model` | string | `''` | 模型 id；留空使用 DSH 默认模型选择 |
| `dmPolicy` | enum | `pairing` | 私聊策略：`open` / `pairing` / `allowlist` / `disabled` |
| `allowFrom` | array | `[]` | 私聊白名单（微信号 / 备注名 / `*`） |
| `groupPolicy` | enum | `allowlist` | 群策略：`open` / `allowlist` / `disabled` |
| `groups` | array | `[]` | 群白名单（群 id / 群名 / `*`） |
| `groupRequireMention` | boolean | `true` | 群内是否需要 @机器人（ilink 群消息本身就是 @触发，此项忽略） |
| `autoAcceptFriend` | boolean | `false` | 自动通过好友请求（仅 wechaty 后端） |
| `mediaMaxMb` | number | `30` | 入站媒体大小上限（MB，仅 wechaty 后端） |
| `mediaDir` | string | `$DSH_HOME/wechat-media` | 入站媒体保存目录（仅 wechaty 后端） |
| `noticeTools` | boolean | `true` | agent 调用工具时发送提示（弹窗「颗粒度」可运行时覆盖） |
| `replyOn` | enum | `step` | 回复时机：`step`（每步完成即发）/ `turn`（回合结束发最终文本）；弹窗「颗粒度=摘要回复」等效 `turn`（可运行时覆盖） |
| `textChunkLimit` | number | `3800` | 单条微信消息文本上限 |

完整示例见 [examples/cordis.patch.example.yml](examples/cordis.patch.example.yml)。

## 后端选择（puppet）

### ilink（默认，推荐）

对接**微信官方 iLink 机器人平台**——与腾讯官方 OpenClaw 微信插件（`@tencent-weixin/openclaw-weixin`，即「微信 clawbot」）相同的后端协议：

- 网关 `https://ilinkai.weixin.qq.com`；`get_bot_qrcode` 出官方配对二维码 → 手机微信扫码 → 屏幕显示配对码，在 Web 弹窗输入 → 确认后 `bot_token` 自动保存到 `$DSH_HOME/dsh-wechat-ilink.json`，重启免扫码
- `getupdates` 长轮询收消息（文本 + 语音转文字；图片/视频/文件以摘要占位）、`sendmessage` 发回复
- 会话失效（errcode -14）自动回到待扫码态；解绑清凭据
- 账号安全：不是网页版协议登录你的个人号，而是给微信里的官方机器人发消息（clawbot 模式）

### wechaty 系（备选）

| puppet 包名 | 说明 | 成本 |
| --- | --- | --- |
| `wechaty-puppet-wechat` / `wechaty-puppet-wechat4u` | 网页版微信协议，扫码登录 | 免费（有风控风险，日志 1101 刷屏属会话失效） |
| `wechaty-puppet-official-account` | 微信公众号官方协议 | 免费（需服务号） |
| `@juzi/wechaty-puppet-service` | 桔子云 BOT 托管服务 | 商业 token |
| `wechaty-puppet-wcferry` | WeChatFerry（注入 Windows 桌面微信） | 免费（Windows 挂机） |

后三个是可选依赖：`npm i <包名>` 手动补齐。wechaty 后端默认 `WECHATY_LOG=error` 抑制 puppet 内部 WARN 刷屏（可环境变量覆盖）。启动后在 Web 端侧边栏「微信」入口扫码（二维码只在弹窗显示，不打印终端）。

## 使用

### Web 端配对弹窗

侧边栏底部「微信」手机图标（设置旁边）打开「微信机器人」管理弹窗，界面与交互对齐 zcode Bot Channel 的微信管理页：

- **关联机器人**：显示官方配对二维码（ilink）或登录二维码（wechaty），扫码状态实时翻译成「等待手机扫码 / 已扫码请在手机确认 / 二维码已过期」等文案，不暴露状态码；**ilink 配对时手机会显示一串数字，在弹窗输入框提交**即可完成绑定。「无法扫码」时可复制备用链接在手机浏览器打开。登录后凭据自动保存（重启免扫码），显示已连通账号，可随时**解绑**。关闭弹窗不会断开连接。
- **机器人回复颗粒度**：完整回复（每步 + 工具调用提示）/ 标准回复（每步文本）/ 摘要回复（仅回合结束发结果），即时生效。
- **工作区访问范围**：多选（zcode 同款 checkbox 列表）。默认「所有工作区」= 不限制，agent 工作目录用插件配置的 `workspace`（默认 dsh 启动目录，建议在 cordis.patch.yml 里显式配置）。勾选若干工作区后，**每个微信主体默认在第一个勾选的工作区工作**，且可在微信里随时 `/ws` 切换——每个工作区一段独立会话历史，切回来还能继续。

弹窗里的颗粒度/工作区范围写入 `$DSH_HOME/dsh-wechat.state.json`（原子写，重启保持；旧版单选格式自动迁移为多选）；cordis.patch.yml 里的 `replyOn`/`noticeTools` 是缺省基准值。无 workspaceRegistry 的 profile（headless）工作区列表为空，`/ws` 会提示去 Web 弹窗配置。`/ws` 的当前选择是进程内存态，dsh 重启后回到默认工作区。

### 微信对话

登录成功后，直接给机器人发微信消息即可对话。控制命令：

| 命令 | 作用 |
| --- | --- |
| `/new` | 结束当前会话，下条消息开始全新会话 |
| `/stop` | 中止当前运行中的任务 |
| `/status` | 查看会话状态（含当前工作区） |
| `/ws` | 列出可用工作区；`/ws 2` 按序号切换，`/ws 名称` 按名称切换（每个工作区会话独立） |
| `/help` | 帮助 |

群聊需要 **@机器人** 才会响应（可配置 `groupRequireMention: false` 关闭）。

## 实现原理

插件注入 DSH 的核心服务（`agents`、`sessions`、`agentDefaultModel`），完全复用 DSH 的会话/agent 体系：

1. 入站微信消息按主体（用户 / 群）映射到稳定的会话 id（`wechat:<kind>:<id>`），通过 `agents.create()` 为该主体创建专属 agent 并 `followup()` 用户消息；
2. 订阅 DSH 的 `session/event` 事件流，过滤本插件前缀的会话，把 `assistant/message` 文本、`tool/call` 提示、`turn/end` 错误摘要发回微信；
3. agent 的模型/工作目录/会话历史全部由 DSH 现有插件（LLM 适配器、持久化、工具）提供，微信只是另一块前端。

## 开发

```bash
npm install
npm run typecheck   # 对 dsh 包（rc.7）类型检查
npm test            # vitest：43 个用例（配置/策略/格式化/会话路由/后端全链路）
npm run build       # 编译 lib/
```

冒烟验证（在隔离 DSH_HOME 里跑真实 web profile）：

```bash
DSH_HOME=/tmp/dsh-wechat-smoke dsh plugin --profile web add /path/to/dsh-wechat
# 写入 insert 条目后：
DSH_HOME=/tmp/dsh-wechat-smoke dsh --profile web --port 31789
```

## License

MIT
