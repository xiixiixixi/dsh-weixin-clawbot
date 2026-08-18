# dsh-wechat

**DeepSeek Harness 微信远程控制插件**：把微信变成 DSH 的远程终端。DSH 通过 [Wechaty](https://wechaty.js.org/) 登录微信后，你用微信给机器人发消息，消息进入一个专属的 DSH agent 会话；agent 的回复、工具调用提示和错误摘要会实时发回你的微信。

- 私聊即对话：每个微信用户拥有独立、持续的 agent 会话
- 群聊支持：@机器人触发，群白名单/开放策略
- 安全：私聊支持 `open` / `pairing`（配对码）/ `allowlist` / `disabled` 四种策略
- 媒体：图片/文件/语音/视频会保存到本地并以路径形式交给 agent
- 控制命令：`/new`、`/stop`、`/status`、`/help`
- 多后端：网页版微信 / 微信公众号 / 桔子云 BOT / WeChatFerry

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
        puppet: wechaty-puppet-wechat
        dmPolicy: pairing
        groupPolicy: allowlist
        groups: []
EOF
```

> `cordis.patch.yml` 是 profile 的用户补丁层，`insert:` 把新条目追加进组合树。

## 配置

| 配置 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 是否启用 |
| `name` | string | `dsh-wechat` | wechaty 实例名 |
| `puppet` | string | `wechaty-puppet-wechat` | 接入后端包名 |
| `puppetOptions` | object | `{}` | 后端参数（token / appId / host 等） |
| `workspace` | string | `process.cwd()` | agent 的工作目录 |
| `model` | string | `''` | 模型 id；留空使用 DSH 默认模型选择 |
| `dmPolicy` | enum | `pairing` | 私聊策略：`open` / `pairing` / `allowlist` / `disabled` |
| `allowFrom` | array | `[]` | 私聊白名单（微信号 / 备注名 / `*`） |
| `groupPolicy` | enum | `allowlist` | 群策略：`open` / `allowlist` / `disabled` |
| `groups` | array | `[]` | 群白名单（群 id / 群名 / `*`） |
| `groupRequireMention` | boolean | `true` | 群内是否需要 @机器人 |
| `autoAcceptFriend` | boolean | `false` | 自动通过好友请求 |
| `mediaMaxMb` | number | `30` | 入站媒体大小上限（MB） |
| `mediaDir` | string | `$DSH_HOME/wechat-media` | 入站媒体保存目录 |
| `noticeTools` | boolean | `true` | agent 调用工具时发送提示 |
| `replyOn` | enum | `step` | 回复时机：`step`（每步完成即发）/ `turn`（回合结束发最终文本） |
| `textChunkLimit` | number | `3800` | 单条微信消息文本上限 |

完整示例见 [examples/cordis.patch.example.yml](examples/cordis.patch.example.yml)。

## 后端选择（puppet）

| puppet 包名 | 说明 | 成本 |
| --- | --- | --- |
| `wechaty-puppet-wechat` | 网页版微信协议，扫码登录 | 免费 |
| `wechaty-puppet-official-account` | 微信公众号官方协议 | 免费（需服务号） |
| `@juzi/wechaty-puppet-service` | 桔子云 BOT 托管服务 | 商业 token |
| `wechaty-puppet-wcferry` | WeChatFerry（注入 Windows 桌面微信） | 免费（Windows 挂机） |

后三个是可选依赖：`npm i <包名>` 手动补齐。启动后按 DSH 日志里的二维码用微信扫码登录。

## 使用

登录成功后，直接给机器人发微信消息即可对话。控制命令：

| 命令 | 作用 |
| --- | --- |
| `/new` | 结束当前会话，下条消息开始全新会话 |
| `/stop` | 中止当前运行中的任务 |
| `/status` | 查看会话状态 |
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
