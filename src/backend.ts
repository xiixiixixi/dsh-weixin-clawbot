/**
 * 微信后端：桥接 wechaty 消息与 DSH agent 会话。
 *
 * - 入站：微信消息 → 策略判断 → 每个微信主体一个 Agent → `followup`
 * - 出站：订阅 `session/event`，把本插件会话的 assistant 文本发回微信
 * - 网页：暴露 `/wechat/qrcode` 状态，供 Web GUI 的扫码窗口轮询登录二维码
 *
 * @module dsh-wechat/backend
 */

import type { Context } from '@deepseek-ai/cordis'
import { installModelSelection, type Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session'
import type { Contact, Friendship, Message, Wechaty } from '@juzi/wechaty'
import QRCode from 'qrcode'

import { createWechatBot, resolvePuppetConfig, saveInboundMedia, sendToRecipient } from './bot.js'
import { resolveMediaDir, type WechatConfig } from './config.js'
import {
  HELP_TEXT,
  chunkForWechat,
  extractAssistantText,
  mediaPlaceholder,
  parseControlCommand,
  turnEndSummary,
} from './format.js'
import { IlinkChannel, type IlinkInboundMessage } from './ilink.js'
import { decideDm, decideGroup } from './policy.js'
import {
  granularityFromConfig,
  loadState,
  noticeToolsOf,
  replyOnOf,
  resolveStatePath,
  saveState,
  type Granularity,
  type RuntimeOverrides,
  type WorkspaceLite,
  type WorkspaceScope,
} from './state.js'
import {
  isWechatSession,
  sessionIdFor,
  subjectFromSessionId,
  type WechatSubject,
} from './sessions.js'

type OwnedAgent = {
  agent: Agent
  dispose: () => Promise<void>
}

/** 主体在 subjectWorkspace 映射里的 key。 */
function subjectKey(subject: WechatSubject): string {
  return `${subject.kind}:${subject.id}`
}

/** 微信登录/扫码状态（供 Web GUI 扫码窗口展示）。verifyCode 仅 iLink 配对码阶段出现。 */
export type WechatQrState =
  | { kind: 'none' }
  | { kind: 'scan'; qrcode: string; status: number; png: string; verifyCode?: 'needed' | 'wrong' | 'blocked' }
  | { kind: 'logged-in'; userId: string; userName: string }

/** `/wechat/qrcode` 路由的响应载荷。 */
export type WechatQrPayload = {
  ok: boolean
  state: WechatQrState
  /** 扫码备用链接（终端/手机浏览器打开）。 */
  url?: string
  /** 已登录用户信息。 */
  user?: { id: string; name: string }
  /** 当前 puppet 后端包名。 */
  puppet: string
  /** 生效的运行时设置。 */
  settings: { granularity: Granularity; workspaceScope: WorkspaceScope }
  /** workspaceRegistry 投影（无注册表时为空）。 */
  workspaces: WorkspaceLite[]
}

/** workspaceRegistry 的最小结构类型：避免新增包依赖。 */
export type WorkspaceRegistryLike = {
  list(): ReadonlyArray<{ id: unknown; title: string; path: string }>
}

/** sessionPersistence 的最小结构类型（读持久化事件用于 seed 接管）。 */
export type SessionPersistenceLike = {
  inspect(id: SessionId): Promise<{ meta: { cwd: string }; events: readonly SessionEvent[] }>
}

// 本地结构类型增强：真实服务由 @deepseek-ai/dsh-workspace 提供（运行时注入），
// 插件编译不依赖该包，只声明自己用到的 list() 面。
declare module '@deepseek-ai/cordis' {
  interface Context {
    workspaceRegistry?: WorkspaceRegistryLike
    sessionPersistence?: SessionPersistenceLike
  }
}

export class WechatBackend {
  private bot: Wechaty | undefined
  private readonly owned = new Map<string, OwnedAgent>()
  private currentUser: Contact | undefined
  private started = false
  private readonly disposers: Array<() => void> = []
  private readonly log: (message: string) => void
  private qrState: WechatQrState = { kind: 'none' }
  private workspaceRegistry: WorkspaceRegistryLike | undefined
  private overrides: RuntimeOverrides = {}
  private readonly stateFile: string
  /** 主体 → /ws 切换的当前工作区 id（内存态，重启回默认）。 */
  private readonly subjectWorkspace = new Map<string, string>()
  /** 主体 → 当前会话 id（/new 后换成新生代 id；重启回到基础 id 并恢复历史）。 */
  private readonly subjectSession = new Map<string, SessionId>()
  /** /new 标记：下条消息铸造全新会话 id（保证不与持久化日志撞车）。 */
  private readonly freshNext = new Set<string>()
  /** 已尝试过 seed 接管检查的会话 id（避免重复 inspect）。 */
  private readonly seedChecked = new Set<string>()
  /** 持久化服务（index.ts 懒注入）。 */
  private sessionPersistence: SessionPersistenceLike | undefined

  constructor(
    private readonly ctx: Context,
    private readonly config: WechatConfig,
    stateFile: string = resolveStatePath(),
  ) {
    // 双写：cordis logger 之外同时落 stderr，nohup/终端都能看到 [wechat] 日志
    this.log = (message: string) => {
      this.ctx.logger.info(message)
      console.error(message)
    }
    this.stateFile = stateFile
  }

  /** 当前二维码/登录状态（HTTP 路由读取）。 */
  qrPayload(): WechatQrPayload {
    if (this.qrState.kind === 'scan') {
      return {
        ok: true,
        state: this.qrState,
        url: `https://wechaty.js.org/qrcode/${encodeURIComponent(this.qrState.qrcode)}`,
        puppet: this.config.puppet,
        settings: this.effectiveSettings(),
        workspaces: this.workspacesProjection(),
      }
    }
    if (this.qrState.kind === 'logged-in') {
      return {
        ok: true,
        state: this.qrState,
        user: { id: this.qrState.userId, name: this.qrState.userName },
        puppet: this.config.puppet,
        settings: this.effectiveSettings(),
        workspaces: this.workspacesProjection(),
      }
    }
    return {
      ok: true,
      state: { kind: 'none' },
      puppet: this.config.puppet,
      settings: this.effectiveSettings(),
      workspaces: this.workspacesProjection(),
    }
  }

  /** workspaceRegistry 注入/撤销（index.ts 懒注入调用）。 */
  setWorkspaceRegistry(registry: WorkspaceRegistryLike | undefined): void {
    this.workspaceRegistry = registry
  }

  /** sessionPersistence 注入/撤销（index.ts 懒注入调用）。 */
  setSessionPersistence(persistence: SessionPersistenceLike | undefined): void {
    this.sessionPersistence = persistence
  }

  /** 工作区列表投影（无注册表时空数组）。 */
  workspacesProjection(): WorkspaceLite[] {
    return (this.workspaceRegistry?.list() ?? []).map((workspace) => ({
      id: String(workspace.id),
      title: workspace.title,
      path: workspace.path,
    }))
  }

  /** 当前生效设置：state 覆盖优先，缺省从静态配置推导。 */
  effectiveSettings(): { granularity: Granularity; workspaceScope: WorkspaceScope } {
    return {
      granularity: this.overrides.granularity ?? granularityFromConfig(this.config),
      workspaceScope: this.overrides.workspaceScope ?? 'all',
    }
  }

  /** 允许访问的工作区 id 列表（'all' = 全部；多选时与现存工作区求交集）。 */
  allowedWorkspaceIds(): string[] {
    const scope = this.effectiveSettings().workspaceScope
    const existing = this.workspacesProjection()
    if (scope === 'all') return existing.map((workspace) => workspace.id)
    const known = new Set(existing.map((workspace) => workspace.id))
    return scope.workspaceIds.filter((id) => known.has(id))
  }

  /** 主体的当前工作区 id：/ws 切换的内存覆盖（须仍在允许范围内），否则默认。 */
  private currentWorkspaceId(subject: WechatSubject): string | undefined {
    const override = this.subjectWorkspace.get(subjectKey(subject))
    if (override !== undefined && this.allowedWorkspaceIds().includes(override)) return override
    return this.allowedWorkspaceIds()[0]
  }

  /** 会话路由：当前工作区 → 会话 id（每工作区独立历史）+ agent cwd。 */
  private routeFor(subject: WechatSubject): { sessionId: SessionId; cwd: string; workspaceId?: string } {
    const workspaceId = this.currentWorkspaceId(subject)
    const base = sessionIdFor(subject, workspaceId)
    const key = subjectKey(subject)

    let sessionId = this.subjectSession.get(key)
    // 记住的会话不属于当前工作区（/ws 切换后）→ 回到该工作区的基础 id
    if (sessionId === undefined || (!String(sessionId).startsWith(`${base}`) && String(sessionId) !== base)) {
      sessionId = base
    }
    // /new：铸造全局唯一的新生代 id，绝不与磁盘日志撞车
    if (this.freshNext.has(key)) {
      this.freshNext.delete(key)
      sessionId = SessionId(`${base}~${Date.now().toString(36)}`)
    }
    this.subjectSession.set(key, sessionId)

    return {
      sessionId,
      cwd: this.cwdFor(workspaceId),
      workspaceId,
    }
  }

  /** 工作区 id → agent cwd；未指定/已消失时回退静态配置。 */
  private cwdFor(workspaceId: string | undefined): string {
    if (workspaceId !== undefined) {
      const hit = this.workspacesProjection().find((workspace) => workspace.id === workspaceId)
      if (hit) return hit.path
    }
    return this.config.workspace
  }

  /** 合并覆盖 → 持久化 → 返回生效值（弹窗 POST /wechat/settings 调用）。 */
  updateSettings(patch: RuntimeOverrides): { granularity: Granularity; workspaceScope: WorkspaceScope } {
    this.overrides = { ...this.overrides, ...patch }
    saveState(this.stateFile, this.overrides)
    return this.effectiveSettings()
  }

  /** 解绑：登出微信、复位扫码状态（幂等）。 */
  async logout(): Promise<void> {
    const ilink = this.ilinkChannel
    if (ilink !== undefined) {
      this.contextTokens.clear()
      await ilink.logout()
      this.currentUser = undefined
      this.qrState = { kind: 'none' }
      // 解绑后立刻回到待扫码态，弹窗出新的二维码
      void this.runIlinkLoginLoop()
      return
    }
    await this.bot?.logout().catch((error: unknown) =>
      this.log(`[wechat] 解绑失败: ${String(error)}`),
    )
    this.currentUser = undefined
    this.qrState = { kind: 'none' }
  }

  /** 测试可见的 agent 创建入口。 */
  async getOrCreateAgentForTest(sessionId: SessionId, cwd: string): Promise<Agent> {
    return this.getOrCreateAgent(sessionId, cwd)
  }

  /** 异步渲染二维码 PNG（供 Web 扫码窗口内嵌显示）；保留同码上的 verifyCode 标记。 */
  private async renderQrPng(qrcode: string, status: number): Promise<void> {
    try {
      const png = await QRCode.toDataURL(qrcode, { margin: 1, width: 480 })
      // 只认最新二维码，避免过期码覆盖新码
      if (this.qrState.kind === 'scan' && this.qrState.qrcode === qrcode) {
        this.qrState = { ...this.qrState, status, png }
      }
    } catch (error) {
      this.log(`[wechat] 二维码渲染失败: ${String(error)}`)
    }
  }

  /** 启动：订阅会话事件、解析 puppet、启动微信通道（wechaty 或 iLink）。 */
  async start(): Promise<void> {
    if (!this.config.enabled) return
    this.overrides = loadState(this.stateFile)

    this.disposers.push(
      this.ctx.on('session/event', (session: Session, event: SessionEvent) => {
        void this.onSessionEvent(session, event)
      }),
    )

    if (this.config.puppet === 'ilink') {
      await this.startIlink()
      return
    }

    const resolved = await resolvePuppetConfig(this.config.puppet, this.config.puppetOptions)
    const bot = createWechatBot({
      name: this.config.name,
      puppet: resolved.puppet as string,
      puppetOptions: resolved.puppetOptions,
      log: this.log,
      onScan: (qrcode, status) => {
        this.qrState = { kind: 'scan', qrcode, status, png: '' }
        void this.renderQrPng(qrcode, status)
      },
      onLogin: (user) => {
        this.currentUser = user
        this.qrState = { kind: 'logged-in', userId: user.id, userName: user.name() }
      },
      onLogout: () => {
        this.currentUser = undefined
        this.qrState = { kind: 'none' }
      },
      onMessage: (message) => this.handleMessage(message),
      onFriendship: (friendship) => this.handleFriendship(friendship),
      onError: (error) => this.log(`[wechat] ${error.message}`),
    })
    this.bot = bot

    await bot.start()
    this.started = true
    this.log(`[wechat] 已启动（puppet: ${this.config.puppet}）`)
  }

  // ── iLink 官方通道（clawbot） ────────────────────────────────

  private ilinkChannel: IlinkChannel | undefined
  /** ilink 出站回复需携带的每对端最新 context_token。 */
  private readonly contextTokens = new Map<string, string>()
  /** 二维码自动刷新次数上限。 */
  private static readonly ILINK_QR_REFRESH_LIMIT = 5

  private async startIlink(): Promise<void> {
    const channel = new IlinkChannel({
      stateFile: this.stateFile.replace(/dsh-wechat\.state\.json$/, 'dsh-wechat-ilink.json'),
      log: this.log,
    })
    channel.setBotAgent(
      typeof this.config.puppetOptions.botAgent === 'string'
        ? this.config.puppetOptions.botAgent
        : undefined,
    )
    this.ilinkChannel = channel
    this.started = true

    const saved = channel.savedCredentials()
    if (saved) {
      this.qrState = { kind: 'logged-in', userId: saved.botId, userName: `微信机器人 ${saved.botId}` }
      this.log(`[wechat] iLink 使用已保存凭据自动登录（bot: ${saved.botId}）`)
      void this.runIlinkLoop()
    } else {
      this.log('[wechat] iLink 无已保存凭据，等待在 Web 弹窗扫码')
      void this.runIlinkLoginLoop()
    }
  }

  /** iLink 扫码登录循环：出二维码 → 长轮询状态 → 确认后进入消息循环。 */
  private async runIlinkLoginLoop(): Promise<void> {
    const channel = this.ilinkChannel
    if (channel === undefined) return
    let refreshCount = 0

    while (this.started && this.ilinkChannel === channel && channel.savedCredentials() === undefined) {
      try {
        const qrUrl = channel.currentQrUrl() ?? (await channel.startLogin())
        this.qrState = { kind: 'scan', qrcode: qrUrl, status: 2, png: '' }
        void this.renderQrPng(qrUrl, 2)

        const tick = await channel.pollLoginOnce()
        switch (tick.kind) {
          case 'wait':
            break
          case 'scaned':
            this.qrState = { kind: 'scan', qrcode: qrUrl, status: 3, png: this.qrState.kind === 'scan' ? this.qrState.png : '' }
            break
          case 'need-verifycode':
            this.qrState = {
              kind: 'scan', qrcode: qrUrl, status: 3,
              png: this.qrState.kind === 'scan' ? this.qrState.png : '',
              verifyCode: tick.wrongCode ? 'wrong' : 'needed',
            }
            break
          case 'verify-code-blocked':
            this.qrState = {
              kind: 'scan', qrcode: qrUrl, status: 3,
              png: this.qrState.kind === 'scan' ? this.qrState.png : '',
              verifyCode: 'blocked',
            }
            break
          case 'expired': {
            refreshCount += 1
            if (refreshCount > WechatBackend.ILINK_QR_REFRESH_LIMIT) {
              this.log('[wechat] iLink 二维码多次过期，暂停登录；刷新页面或解绑后重试')
              this.qrState = { kind: 'none' }
              return
            }
            // 下一轮循环 startLogin 会取新码
            break
          }
          case 'binded':
            // 已绑定过：凭据应已存在，走消息循环
            break
          case 'confirmed': {
            const { botId } = tick.credentials
            this.qrState = { kind: 'logged-in', userId: botId, userName: `微信机器人 ${botId}` }
            await this.runIlinkLoop()
            return
          }
        }
      } catch (error) {
        this.log(`[wechat] iLink 登录流程异常（3s 后重试）: ${String(error)}`)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    }
  }

  /** iLink 消息循环包装：结束后回到待扫码态（如会话失效 -14）。 */
  private async runIlinkLoop(): Promise<void> {
    const channel = this.ilinkChannel
    if (channel === undefined) return
    await channel.runMessageLoop(
      (message) => void this.handleIlinkMessage(message),
      (error) => this.log(`[wechat] iLink 消息循环错误: ${String(error)}`),
    )
    // 循环退出且凭据已失效 → 回到扫码
    if (this.started && this.ilinkChannel === channel && channel.savedCredentials() === undefined) {
      this.currentUser = undefined
      void this.runIlinkLoginLoop()
    }
  }

  /** iLink 入站消息：策略检查后走与 wechaty 相同的分发管线。 */
  private async handleIlinkMessage(message: IlinkInboundMessage): Promise<void> {
    if (!this.started) return
    const subject: WechatSubject = message.groupId !== undefined
      ? { kind: 'group', id: message.groupId }
      : { kind: 'direct', id: message.fromUserId }

    if (message.contextToken !== undefined) {
      this.contextTokens.set(subject.id, message.contextToken)
    }

    if (subject.kind === 'group') {
      // iLink 群消息本身就是 @机器人触发的，视为已 mention
      const decision = decideGroup(this.config, { roomId: subject.id, roomTopic: undefined, mentionSelf: true })
      if (!decision.allowed) return
    } else {
      const decision = decideDm(this.config, { id: subject.id, name: subject.id })
      if (!decision.allowed) {
        if (decision.reason === 'pairing') {
          await this.reply(subject.id, this.config.pairingNotice)
        }
        return
      }
    }

    const body = [message.text, message.mediaNote].filter(Boolean).join('\n')
    if (body === '') return
    await this.dispatchToAgent(subject, body)
  }

  /** 用户在弹窗提交手机配对码（仅 iLink）。 */
  submitVerifyCode(code: string): void {
    this.ilinkChannel?.submitVerifyCode(code)
  }

  /** 关闭：停止微信通道、释放全部会话与事件订阅。 */
  async dispose(): Promise<void> {
    this.started = false
    for (const disposer of this.disposers.splice(0)) disposer()
    for (const { dispose } of this.owned.values()) {
      await dispose().catch((error: unknown) =>
        this.log(`[wechat] 释放会话失败: ${String(error)}`),
      )
    }
    this.owned.clear()
    this.ilinkChannel?.stop()
    this.ilinkChannel = undefined
    this.contextTokens.clear()
    await this.bot?.stop().catch((error: unknown) =>
      this.log(`[wechat] 停止机器人失败: ${String(error)}`),
    )
    this.bot = undefined
    this.qrState = { kind: 'none' }
  }

  /** 入站微信消息 → agent。 */
  private async handleMessage(message: Message): Promise<void> {
    if (!this.started || !this.bot) return
    if (message.self()) return

    const from = message.talker()
    const room = message.room()
    const text = message.text()
    const isGroup = Boolean(room)

    let mentionSelf = false
    if (room && this.currentUser) {
      try {
        mentionSelf = message.mentionSelf()
      } catch {
        mentionSelf = false
      }
    }

    const subject: WechatSubject = isGroup
      ? { kind: 'group', id: room!.id }
      : { kind: 'direct', id: from.id }

    if (isGroup) {
      const decision = decideGroup(this.config, {
        roomId: room!.id,
        roomTopic: await room!.topic().catch(() => undefined),
        mentionSelf,
      })
      if (!decision.allowed) {
        if (decision.reason === 'no-mention') this.log(`[wechat] 忽略群消息（未 @机器人）: ${room!.id}`)
        return
      }
    } else {
      const decision = decideDm(
        this.config,
        { id: from.id, name: from.name() },
      )
      if (!decision.allowed) {
        if (decision.reason === 'pairing') {
          await sendToRecipient(this.bot, from.id, { text: this.config.pairingNotice, log: this.log })
        }
        return
      }
    }

    const command = parseControlCommand(text)
    if (command) {
      await this.handleCommand(subject, command)
      return
    }

    const mediaDir = resolveMediaDir(this.config)
    const media = await saveInboundMedia({
      message,
      mediaDir,
      maxBytes: this.config.mediaMaxMb * 1024 * 1024,
      log: this.log,
    })

    let body = text.trim()
    if (media) {
      const placeholder = mediaPlaceholder(media.kind, media.path)
      body = body ? `${body}\n${placeholder}` : placeholder
    }
    if (!body) return
    await this.dispatchToAgent(subject, body)
  }

  /** 控制命令与 agent followup 的共用分发管线。 */
  private async dispatchToAgent(subject: WechatSubject, body: string): Promise<void> {
    const command = parseControlCommand(body)
    if (command) {
      await this.handleCommand(subject, command)
      return
    }

    const { sessionId, cwd } = this.routeFor(subject)
    const agent = await this.getOrCreateAgent(sessionId, cwd)
    agent.followup(
      createUserMessage({
        content: [{ type: 'text', text: body }],
        source: { kind: 'user' },
      }),
    )
    this.log(
      `[wechat] 入站 ${subject.kind === 'group' ? `群 ${subject.id}` : `用户 ${subject.id}`}: ${body.slice(0, 120)}`,
    )
  }

  /** 好友请求处理：按配置自动通过。 */
  private async handleFriendship(friendship: Friendship): Promise<void> {
    if (!this.config.autoAcceptFriend) return
    // 类型 2 = 收到好友请求（wechaty-puppet FriendshipType.Receive）
    if (friendship.type() === 2) {
      await friendship.accept()
      const contact = friendship.contact()
      this.log(`[wechat] 已自动通过好友请求: ${contact.name()} (${contact.id})`)
    }
  }

  /** 会话事件 → 微信回复。 */
  private async onSessionEvent(session: Session, event: SessionEvent): Promise<void> {
    if (!this.started) return
    if (this.bot === undefined && this.ilinkChannel === undefined) return
    if (!isWechatSession(session.id)) return
    const subject = subjectFromSessionId(session.id)
    if (!subject) return
    const targetId = subject.id

    switch (event.type) {
      case 'assistant/message': {
        if (replyOnOf(this.effectiveSettings().granularity) !== 'step') return
        const text = extractAssistantText(event.data.message)
        if (text.trim()) await this.reply(targetId, text)
        return
      }
      case 'tool/call': {
        if (noticeToolsOf(this.effectiveSettings().granularity)) {
          await this.reply(targetId, `🔧 调用工具 ${event.data.name}`)
        }
        return
      }
      case 'turn/end': {
        if (replyOnOf(this.effectiveSettings().granularity) === 'turn') {
          const last = session.events.findLast((entry) => entry.type === 'assistant/message')
          if (last && last.type === 'assistant/message') {
            const text = extractAssistantText(last.data.message)
            if (text.trim()) await this.reply(targetId, text)
          }
        }
        const summary = turnEndSummary(event.data.reason)
        if (summary) await this.reply(targetId, summary)
        return
      }
      default:
        return
    }
  }

  /** 控制命令。 */
  private async handleCommand(subject: WechatSubject, command: ReturnType<typeof parseControlCommand>): Promise<void> {
    if (this.bot === undefined && this.ilinkChannel === undefined) return
    const targetId = subject.id
    const route = this.routeFor(subject)
    const key = String(route.sessionId)
    const owned = this.owned.get(key)

    switch (command?.kind) {
      case 'new': {
        if (owned) {
          await owned.dispose().catch((error: unknown) =>
            this.log(`[wechat] 释放会话失败: ${String(error)}`),
          )
          this.owned.delete(key)
        }
        // 标记下条消息用全新会话 id（同 id 重新 create 会撞持久化日志）
        this.freshNext.add(subjectKey(subject))
        await this.reply(targetId, '已开始新会话。')
        return
      }
      case 'stop': {
        if (owned && owned.agent.status === 'running') {
          owned.agent.cancel({ kind: 'user' })
          await this.reply(targetId, '已请求停止当前任务。')
        } else {
          await this.reply(targetId, '当前没有运行中的任务。')
        }
        return
      }
      case 'status': {
        const workspaceTitle = route.workspaceId !== undefined
          ? this.workspacesProjection().find((workspace) => workspace.id === route.workspaceId)?.title
          : undefined
        await this.reply(
          targetId,
          [
            `会话: ${route.sessionId}`,
            `状态: ${owned ? (owned.agent.status === 'running' ? '运行中' : '空闲') : '无活跃会话'}`,
            workspaceTitle !== undefined ? `工作区: ${workspaceTitle}` : `工作目录: ${route.cwd}`,
          ].join('\n'),
        )
        return
      }
      case 'ws': {
        await this.reply(targetId, this.wsCommandReply(subject, command.arg))
        return
      }
      case 'help': {
        await this.reply(targetId, HELP_TEXT)
        return
      }
      default:
        return
    }
  }

  /** /ws 命令：无参列出可切换的工作区；有序号/名称则切换当前主体的工作区。 */
  private wsCommandReply(subject: WechatSubject, arg: string | undefined): string {
    const allowed = this.allowedWorkspaceIds()
    const projection = this.workspacesProjection()
    const rows = allowed
      .map((id) => projection.find((workspace) => workspace.id === id))
      .filter((workspace): workspace is WorkspaceLite => workspace !== undefined)

    if (rows.length === 0) {
      return [
        '当前没有可选择的工作区（未勾选任何工作区，或 DSH 未提供工作区注册表）。',
        `默认工作目录：${this.config.workspace}`,
        '在 Web 端「微信机器人」弹窗勾选工作区后即可用 /ws 切换。',
      ].join('\n')
    }

    const currentId = this.currentWorkspaceId(subject)
    const list = rows
      .map((workspace, index) => {
        const mark = workspace.id === currentId ? ' ◀ 当前' : ''
        return `${index + 1}. ${workspace.title}  ${workspace.path}${mark}`
      })
      .join('\n')

    if (arg === undefined) {
      return `工作区（切换：/ws 序号 或 /ws 名称）\n${list}`
    }

    // 序号匹配
    const index = Number.parseInt(arg, 10)
    let target: WorkspaceLite | undefined
    if (Number.isInteger(index) && index >= 1 && index <= rows.length) {
      target = rows[index - 1]
    } else {
      // 名称/路径子串匹配；命中多个时列出候选
      const needle = arg.toLowerCase()
      const hits = rows.filter((workspace) =>
        workspace.title.toLowerCase().includes(needle)
        || workspace.path.toLowerCase().includes(needle),
      )
      if (hits.length === 1) target = hits[0]
      else if (hits.length > 1) {
        return `「${arg}」匹配到多个工作区，请用序号：\n${list}`
      }
    }

    if (target === undefined) {
      return `没有找到工作区「${arg}」。可用：\n${list}`
    }
    if (target.id === currentId) {
      return `当前就在「${target.title}」。可用：\n${list}`
    }

    this.subjectWorkspace.set(subjectKey(subject), target.id)
    return `已切换到「${target.title}」（${target.path}）。\n下条消息起在这个工作区继续，每个工作区会话独立。`
  }

/** 获取（或创建）一个微信主体专属的 agent（cwd 由路由决定）。

 * dsh 重启后同一会话 id 在磁盘上已有持久化日志：直接 create 会被持久化
 * 协调器判为 id collision。正确姿势是把已存事件作为 seed 传回 create，
 * 走 adopt 分支无冲突接管（历史完整保留）。
 */
private async getOrCreateAgent(sessionId: SessionId, cwd: string): Promise<Agent> {
  const key = String(sessionId)
  const existing = this.owned.get(key)
  if (existing) return existing.agent

  let seed: readonly SessionEvent[] | undefined
  let adoptCwd = cwd
  if (this.sessionPersistence !== undefined && !this.seedChecked.has(key)) {
    this.seedChecked.add(key)
    try {
      const persisted = await this.sessionPersistence.inspect(sessionId)
      if (persisted.events.length > 0) {
        seed = persisted.events
        adoptCwd = persisted.meta.cwd
        this.log(`[wechat] 接管持久化会话 ${sessionId}（${persisted.events.length} 事件）`)
      }
    } catch (error) {
      // 不存在的会话会抛 not found——按新建静默处理；其他错误也降级为新建
      const message = String(error)
      if (!message.includes('not found')) {
        this.log(`[wechat] 读取持久化会话失败（按新建处理）: ${message}`)
      }
    }
  }

  const selection = this.ctx.agentDefaultModel.currentSelection()
  const { agent, dispose } = await this.ctx.agents.create({
    sessionId,
    meta: { cwd: adoptCwd },
    ...(seed !== undefined ? { seed } : {}),
    agentOptions: {
      provider: selection.provider,
      model: this.config.model || selection.model,
    },
    setup: (agentCtx) => {
      installModelSelection(agentCtx, {
        current: selection,
        assembled: undefined,
      })
    },
  })
  this.owned.set(key, { agent, dispose })
  this.log(`[wechat] 已创建会话 ${sessionId}（provider=${selection.provider} model=${this.config.model || selection.model}）`)
  return agent
}

  /** 回复微信：按配置分块发送文本。 */
  private async reply(targetId: string, text: string): Promise<void> {
    const chunks = chunkForWechat(text, this.config.textChunkLimit)
    const ilink = this.ilinkChannel
    if (ilink !== undefined) {
      const contextToken = this.contextTokens.get(targetId)
      for (const chunk of chunks) {
        if (chunk.trim()) {
          await ilink.sendText(targetId, chunk, contextToken).catch((error: unknown) =>
            this.log(`[wechat] iLink 发送失败: ${String(error)}`),
          )
        }
      }
      return
    }
    const bot = this.bot
    if (!bot) return
    await sendToRecipient(bot, targetId, { chunks, log: this.log })
  }
}
